import { Outfit, Archivo, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { ApolloWrapper } from '@/lib/apollo';
import { ToastProvider } from '@/lib/toast';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-outfit', display: 'swap' });
const archivo = Archivo({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-archivo', display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jetbrains', display: 'swap' });

export const metadata = {
  title: 'spotlyte. admin — Super Admin Console',
  description: 'Internal command center for the Spotlyte sports-venue marketplace',
};

// Applies persisted theme/density before first paint (no flash).
const themeInit = `(function(){try{
  var t=localStorage.getItem('sp-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');
  var d=localStorage.getItem('sp-density');if(d&&d!=='regular')document.documentElement.setAttribute('data-density',d);
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${outfit.variable} ${archivo.variable} ${instrument.variable} ${jetbrains.variable}`}>
        <ApolloWrapper>
          <ToastProvider>{children}</ToastProvider>
        </ApolloWrapper>
      </body>
    </html>
  );
}
