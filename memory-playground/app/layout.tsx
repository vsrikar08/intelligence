import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Memory Playground · Patchy',
  description: 'A small memory playground for Patchy’s intelligence layer. Remember a thought and recall it with Mem0.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
