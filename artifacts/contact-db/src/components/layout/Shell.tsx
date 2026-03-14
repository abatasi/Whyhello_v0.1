import { Navbar } from "./Navbar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  );
}
