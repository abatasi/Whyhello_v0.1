import lightLogoUrl from "@assets/Untitled_design_1773415520137.png";

export { lightLogoUrl };
export const darkLogoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-logo-dark-full.png`;

export default function BrandLogo({ size = "header" }: { size?: "header" | "footer" }) {
  const height = size === "footer" ? "h-6" : "h-8";

  return (
    <>
      <img src={lightLogoUrl} alt="Whyhello" className={`${height} w-auto dark:hidden`} />
      <img src={darkLogoUrl} alt="Whyhello" className={`hidden ${height} w-auto dark:block`} />
    </>
  );
}