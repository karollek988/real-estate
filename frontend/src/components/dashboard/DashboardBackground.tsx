import Image from "next/image";

export function DashboardBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <Image
        src="/dashboard-background-picture.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-[0.08]"
      />
      <div className="absolute inset-0 bg-[#111927]/80" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#111927_0%,transparent_25%,transparent_75%,#111927_100%)]" />
    </div>
  );
}
