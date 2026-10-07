import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** The error line under an analysis form. When the account is out of credit it links straight to the store. */
export function AnalysisSubmitError({ error }: { error: { code: string; message: string } | null }) {
  const t = useTranslations("forms");
  if (!error) return null;
  return (
    <p className="text-sm text-red-400">
      {error.message}
      {error.code === "no_credit" && (
        <>
          {" "}
          <Link href="/buy" className="font-semibold text-green-400 underline underline-offset-4 hover:text-green-300">
            {t("goToStore")}
          </Link>
        </>
      )}
    </p>
  );
}
