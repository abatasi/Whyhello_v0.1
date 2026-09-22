import { Navbar } from "./Navbar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col transition-colors duration-200">
      <Navbar />
      <main className="flex-1 w-full flex flex-col min-h-0 md:ml-11 md:w-[calc(100%-44px)]">
        {children}
      </main>
    </div>
  );
}
