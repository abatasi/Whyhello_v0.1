export const lightLogoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-logo-light-full.png`;
export const darkLogoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-logo-dark-full.png`;
export const markLogoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-mark.png`;
export const staticMarkLogoUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-mark-static.svg`;
export const lightWordmarkUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-wordmark-light.png`;
export const darkWordmarkUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/images/whyhello-wordmark-dark.png`;

export default function BrandLogo({ size = "header" }: { size?: "header" | "footer" }) {
  const height = size === "footer" ? "h-6" : "h-8";

  return (
    <>
      <img src={lightLogoUrl} alt="Whyhello" className={`${height} w-auto dark:hidden`} />
      <img src={darkLogoUrl} alt="Whyhello" className={`hidden ${height} w-auto dark:block`} />
    </>
  );
}