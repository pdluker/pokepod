// feed.js — RSS/Atom feed builder for podcast syndication
export function buildRssFeed(config, episodes) {
  const {
    title,
    description,
    siteUrl,
    feedUrl,
    author,
    email,
    imageUrl
  } = config;

  const now = new Date().toUTCString();

  // Build episode items
  const episodeItems = episodes
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .map((ep) => {
      const pubDate = new Date(ep.pubDate).toUTCString();
      const duration = formatDuration(ep.durationSeconds);

      return `<item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.description)}</description>
      <link>${siteUrl}</link>
      <guid>${ep.guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <enclosure url="${ep.audioUrl}" length="${ep.fileSizeBytes}" type="audio/mpeg" />
      <itunes:duration>${duration}</itunes:duration>
      <itunes:image href="${ep.posterUrl}" />
      <itunes:episode>${ep.episodeNumber}</itunes:episode>
    </item>`;
    })
    .join('');

  // Build RSS 2.0 feed with iTunes namespace
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <managingEditor>${email}</managingEditor>
    <webMaster>${email}</webMaster>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>3600</ttl>
    
    <!-- iTunes Metadata -->
    <itunes:author>${escapeXml(author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${escapeXml(author)}</itunes:name>
      <itunes:email>${email}</itunes:email>
    </itunes:owner>
    <itunes:explicit>no</itunes:explicit>
    <itunes:image href="${imageUrl}" />
    <itunes:category text="Games &amp; Hobbies" />
    
    <!-- Feed URL -->
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${feedUrl}" rel="self" type="application/rss+xml" />

    <!-- Episodes -->
    ${episodeItems}
  </channel>
</rss>`;

  return rss;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert seconds to iTunes duration format (HH:MM:SS or MM:SS)
 */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
