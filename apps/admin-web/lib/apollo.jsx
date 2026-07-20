'use client';

// SSR-safe Apollo setup for the App Router (registry pattern):
// one client per server render pass, a singleton in the browser,
// cookies included on every request, and a top-level error link that
// bounces UNAUTHENTICATED sessions back to /login.
import React from 'react';
import { ApolloClient, ApolloProvider, HttpLink, InMemoryCache, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

function makeClient() {
  const errorLink = onError(({ graphQLErrors }) => {
    if (typeof window === 'undefined') return;
    if (graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED')) {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
  });
  const httpLink = new HttpLink({ uri: GRAPHQL_URL, credentials: 'include' });
  return new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
      query: { errorPolicy: 'all' },
    },
    ssrMode: typeof window === 'undefined',
  });
}

let browserClient = null;
export function getApolloClient() {
  if (typeof window === 'undefined') return makeClient();
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}

export function ApolloWrapper({ children }) {
  const client = React.useMemo(getApolloClient, []);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
