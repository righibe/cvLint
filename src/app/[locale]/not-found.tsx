import Link from "next/link";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function NotFound() {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : DEFAULT_LOCALE;
  const { notFound } = getDictionary(locale);

  return (
    <div className="container page-head">
      <h1>{notFound.title}</h1>
      <p>{notFound.text}</p>
      <p>
        <Link className="btn" href={`/${locale}`}>
          {notFound.back}
        </Link>
      </p>
    </div>
  );
}
