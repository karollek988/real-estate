import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** The error line under an analysis form. When the account is out of credit it links straight to the store. */
export function AnalysisSubmitError({ error }: { error: { code: string; message: string } | null }) {
  const t = useTranslations("forms");
  if (!error) return null;
  return (
    <p className="text-sm text-ka-coral-300">
      {error.message}
      {error.code === "no_credit" && (
        <>
          {" "}
          <Link href="/buy" className="font-semibold text-ka-mint underline underline-offset-4 hover:text-ka-mint-bright">
            {t("goToStore")}
          </Link>
        </>
      )}
    </p>
  );
}
