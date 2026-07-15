import './globals.css';
import { connection } from 'next/server';
export const metadata = { title: 'DomainScout AI', description: 'Domain investment research and portfolio platform' };
export default async function RootLayout({children}:{children:React.ReactNode}){
  await connection();
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><div id="main-content" tabIndex={-1}>{children}</div></body></html>;
}
