import './globals.css';
export const metadata = { title: 'DomainScout AI', description: 'Domain investment research and portfolio platform' };
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><div id="main-content" tabIndex={-1}>{children}</div></body></html>;
}
