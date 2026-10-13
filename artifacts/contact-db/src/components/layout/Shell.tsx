import { Navbar } from "./Navbar";
import { LocalAiChat } from "./LocalAiChat";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background transition-colors duration-200">
      <Navbar />
      <main className="flex-1 w-full flex flex-col min-h-0 md:ml-[42px] md:w-[calc(100%-42px)]">
        {children}
      </main>
      <LocalAiChat />
    </div>
  );
}
