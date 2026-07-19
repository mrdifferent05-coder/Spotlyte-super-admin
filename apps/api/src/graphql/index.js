// graphql/index.js — merge base + admin extension so shared types
// (Venue, User, Customer, Dispute, BookingItem, …) resolve once.
import { mergeTypeDefs } from '@graphql-tools/merge';
import { typeDefsBase } from './typeDefs.base.js';
import { typeDefsAdmin, typeDefsAdminExtra } from './typeDefs.admin.js';

export const typeDefs = mergeTypeDefs([typeDefsBase, typeDefsAdmin, typeDefsAdminExtra]);
