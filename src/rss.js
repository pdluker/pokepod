function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRssFeed(showMeta, episodes) {
  const {
    title, description, siteUrl, feedUrl, author, email, imageUrl,
    language = 'en-us', explicit = 'false', category = 'Games & Hobbies'
  } = showMeta;

  const sorted = [...episodes].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const items = sorted.map(ep => `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <description><![CDATA[${ep.description}]]></description>
      <pubDate>${new Date(ep.pubDate).toUTCString()}</pubDate>
      <enclosure url="${ep.audioUrl}" length="${ep.fileSizeBytes}" type="audio/mpeg" />
      <guid isPermaLink="false">${ep.guid}</guid>
      ${ep.posterUrl ? `<itunes:image href="${ep.posterUrl}" />` : ''}
      <itunes:duration>${ep.durationSeconds || ''}</itunes:duration>
      <itunes:explicit>${explicit}</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}</link>
    <language>${language}</language>
    <description><![CDATA[${description}]]></description>
    <itunes:author>${escapeXml(author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(author)}</itunes:name>
      <itunes:email>${email}</itunes:email>
    </itunes:owner>
    <itunes:image href="${imageUrl}" />
    <image>
      <url>${imageUrl}</url>
      <title>${escapeXml(title)}</title>
      <link>${siteUrl}</link>
    </image>
    <itunes:category text="${category}" />
    <itunes:explicit>${explicit}</itunes:explicit>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${feedUrl}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
}
