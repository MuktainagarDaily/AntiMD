import { Helmet } from 'react-helmet-async';
import { useOptionalCity } from '@/hooks/useCity';

export const SITE_URL = 'https://apnatownn.lovable.app';
export const SITE_NAME = 'ApnaTown';

type PageSeoProps = {
  title: string;
  description?: string;
  /** Path beginning with "/" — used to build the absolute canonical and og:url. */
  path?: string;
  image?: string | null;
  /** Set true on private / auth / admin / filtered surfaces. */
  noindex?: boolean;
  /** Optional JSON-LD object(s). Stringified into <script type="application/ld+json">. */
  jsonLd?: object | object[];
  /** Override og:type — defaults to "website". */
  ogType?: string;
  /** Override site_name — defaults to SITE_NAME ('ApnaTown'). */
  siteName?: string;
};

/**
 * Per-route SEO wrapper. Sets <title>, description, canonical, og:* and
 * optional JSON-LD via react-helmet-async. Replaces the static tags in
 * index.html for JS-executing crawlers (Googlebot etc.).
 */
export function PageSeo({
  title,
  description,
  path,
  image,
  noindex,
  jsonLd,
  ogType = 'website',
  siteName,
}: PageSeoProps) {
  const cityCtx = useOptionalCity();
  const effectiveSiteName = siteName || cityCtx?.townBrand || SITE_NAME;
  const url = path ? `${SITE_URL}${path}` : undefined;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {url && <link rel="canonical" href={url} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={effectiveSiteName} />
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}
