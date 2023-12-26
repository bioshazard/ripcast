import { Hono } from 'hono'
import { db } from './lib/db'
// import { compress } from 'hono/compress'
import { serveStatic } from 'hono/bun'

const Body = () => {
  return (
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@1.9.9"></script>
        <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
      </head>
      <body class='p-2'>
        <h1 class='text-2xl'>YTDL<span class='text-gray-500'>RSS</span><span class='text-gray-100'>LOL</span></h1>
        <h2 class='text-xl'>Sources</h2>
        <div>
          <form
            hx-post="/sources"
            hx-target="#sources"
            hx-swap="innerHTML"
            _="on submit target.reset()"
          >
            <input name="url" class='border' />
            <button type="submit">Submit</button>
          </form>
          {/* https://htmx.org/docs/#load_polling */}
          <div id="sources" hx-get="/sources" hx-trigger="load" 
            hx-target="#sources" hx-swap="innerHTML"
          >
            <ul>Loading...</ul>
          </div>
        </div>
      </body>
    </html>
  )
}

const SourcesList = () => {
  const sources = db.query("SELECT rowid, * FROM sources").all()
  return (
    <div>
      <ul>
        {sources.map( (source: any) => (
          <li class='space-x-4'>
            <button class='rounded bg-red-500 px-1 text-white'
              hx-delete={`/sources/${source.rowid}`} hx-confirm="Are you sure?"
              hx-target="#sources" hx-swap="innerHTML"
            >X</button>
            <ul>
            {Object.keys(source).map( key => {
              return key == "url"
                ? <li>URL: <a class="text-blue-500" target='_blank' href={source[key]}>{source[key]}</a></li>
                : <li>{key}: {source[key]}</li>
            })}
            </ul>
            {source.status == "pending" && (
              <button
                hx-post={`/sources/${source.rowid}/queue`}
                hx-target="#sources" hx-swap="innerHTML"
              >Queue</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  ) 
}

// https://twitter.com/i/spaces/1lPKqbPkeLdGb?s=20
const app = new Hono()

// app.use('*', compress())

app.use('/static/*', serveStatic({ root: './', }))
app.use('/favicon.ico', serveStatic({ path: './favicon.ico', }))

app.get('/', (c) => { return c.html(<Body />) })
app.get('/sources', (c) => { return c.html(<SourcesList />) })

app.post('/sources', async (c) => {
  const body = await c.req.parseBody()
  const url = body.url as string
  const status = "pending"
  db.run("INSERT INTO sources(url, status) VALUES(?, ?)", [url, status])
  return c.html(<SourcesList />)
})

app.delete('/sources/:id', async (c) => {
  const id = parseInt( c.req.param("id") )
  db.run("DELETE FROM sources WHERE rowid = ?", [id])
  return c.html(<SourcesList />)
})

interface SourceRow {
  rowid: null,
  url: string,
  created: string,
  published: null | string,
  status: string,
}

const downloadTwitter = async (url: string, filepath: string) => {
  const getDownloadPath = [
    "yt-dlp", url,
    "--cookies", "./data/auth/twitter.coookies",
    "-q", "-x", "--format", "m4a",
    "--print", "after_move:filepath",
    // "-P ./data/downloads"
  ]
  console.log({getDownloadPath})
  const procGetDownload = Bun.spawn(getDownloadPath)
  const downloadPath = (await new Response(procGetDownload.stdout).text()).trim();
  return downloadPath
}

app.post('/sources/:id/queue', async (c) => {
  const rowid = parseInt( c.req.param("id") )
  const source = db.query("SELECT * FROM sources WHERE rowid = ?").all(rowid)[0] as SourceRow
  console.log({source})

  // Download MP3
  // "https://twitter.com/i/spaces/1lPKqbPkeLdGb",
  const getTitle = [
    "yt-dlp", source.url,
    "--cookies", "./data/auth/twitter.coookies",
    "-s", "--print", "title"
  ]
  console.log({getTitle})
  const procGetTitle = Bun.spawn(getTitle)
  const sourceTitle = (await new Response(procGetTitle.stdout).text()).trim();
  // console.log({text}); // => "hello"
  db.run("UPDATE sources SET title = ?, status = 'downloading' WHERE rowid = ?", [sourceTitle, rowid])
  return c.html(<SourcesList />)
})

// RSS XML
// Formatted following https://anchor.fm/s/dfac486c/podcast/rss
import { v5 as uuidv5 } from 'uuid';
import { rssxmleg } from './test/rss'

const uuidNamespace = "1d16ed48-6f54-41d3-b40f-862ff0420de2"
const genSeedUUID = (str: string) => uuidv5(str, uuidNamespace)
const domain = "https://d36fa7f9c45c06f904f5c56144f971f0.serveo.net"
const rssendpiont = "sources/rss"
const rsslink = `${domain}/${rssendpiont}`

const genXML = (sources: any) => {
  
  // <enclosure url="${details.hostedPath}" length="45819697" type="audio/mpeg"/>

//   const item = (details: any) => `
// <item>
//   <title><![CDATA[${details.title}]]></title>
//   <description><![CDATA[${details.title}]]></description>
//   <link>${details.url}</link>
//   <guid isPermaLink="false">${genSeedUUID(details.url)}</guid>
//   <dc:creator><![CDATA[joe@bios.dev]]></dc:creator>
//   <pubDate>${details.published}</pubDate>
//   <enclosure url="${details.hostedPath}" type="audio/mpeg"/>
//   <itunes:summary>${details.title}</itunes:summary>
//   <itunes:explicit>Yes</itunes:explicit>
//   <itunes:duration>01:01:15</itunes:duration>
//   <itunes:image href="https://picsum.photos/seed/picsum/512/512"/>
//   <itunes:episodeType>full</itunes:episodeType>
// </item>`

// const item = (details: any) => `
// <item>
// <title><![CDATA[${details.title}]]></title>
// <description><![CDATA[${details.title}]]></description>
// <link>${details.url}</link>
// <guid isPermaLink="false">${genSeedUUID(details.url)}</guid>
// <dc:creator><![CDATA[joe@bios.dev]]></dc:creator>
// <pubDate>${details.published}</pubDate>
// <enclosure url="https://anchor.fm/s/dfac486c/podcast/play/79616118/https%3A%2F%2Fd3ctxlq1ktw2nl.cloudfront.net%2Fstaging%2F2023-11-5%2Faaa2afba-5db7-4359-40c2-77501f55599a.mp3" length="45819697" type="audio/mpeg"/>
// <itunes:summary>&lt;p&gt;In this candid coaching session, we cover aligning on the mission and purpose behind our podcast, defining milestones to indicate progress, and committing to specific goals to advance the project.&lt;/p&gt;
// &lt;p&gt;- 00:07:00 Setting the stage, intentions for the coaching session&lt;/p&gt;
// &lt;p&gt;- 00:14:30 Describing where we are currently at with the podcast&lt;/p&gt;
// &lt;p&gt;- 00:29:40 Connecting to our &amp;quot;heartbreaking passion&amp;quot; &lt;/p&gt;
// &lt;p&gt;- 00:34:00 Articulating the mission and purpose &lt;/p&gt;
// &lt;p&gt;- 00:41:00 Considering business, non-profit or hobby framing&lt;/p&gt;
// &lt;p&gt;- 00:51:00 Assessing what changes each person can make&lt;/p&gt;
// &lt;p&gt;- 00:54:15 Establishing a content creation goal&lt;/p&gt;
// </itunes:summary>
// <itunes:explicit>Yes</itunes:explicit>
// <itunes:duration>01:01:15</itunes:duration>
// <itunes:image href="https://d3t3ozftmdmh3i.cloudfront.net/production/podcast_uploaded_nologo/37426099/37426099-1682080096296-58054cd256d41.jpg"/>
// <itunes:season>1</itunes:season>
// <itunes:episode>71</itunes:episode>
// <itunes:episodeType>full</itunes:episodeType>
// </item>`

  const items = sources.map( (episode: any) => `
    <item>
      <title><![CDATA[${episode.title}]]></title>
      <description><![CDATA[${episode.title}]]></description>
      <link>${episode.url}</link>
      <guid isPermaLink="false">${genSeedUUID(episode.url)}</guid>
      <dc:creator><![CDATA[joe@bios.dev]]></dc:creator>
      <pubDate>${episode.published}</pubDate>
      <enclosure url="${episode.hostedPath}" type="audio/mpeg"/>
      <itunes:summary>${episode.title}</itunes:summary>
      <itunes:explicit>Yes</itunes:explicit>
      <itunes:duration>01:01:15</itunes:duration>
      <itunes:image href="https://picsum.photos/seed/picsum/512/512"/>
      <itunes:episodeType>full</itunes:episodeType>
    </item>` ).join("\n")


  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:anchor="https://anchor.fm/xmlns">
	<channel>
		<title><![CDATA[mYTDLPOD]]></title>
		<description><![CDATA[Temporary local podcast test]]></description>
		<link>${rsslink}</link>
		<image>
			<url>https://picsum.photos/seed/picsum/512/512</url>
			<title>mYTDLPOD</title>
			<link>${rsslink}</link>
		</image>
		<generator>YTDLPOD</generator>
		<lastBuildDate>Thu, 07 Dec 2023 15:33:01 GMT</lastBuildDate>
		<atom:link href="${rsslink}" rel="self" type="application/rss+xml"/>
		<author><![CDATA[bios.dev]]></author>
		<copyright><![CDATA[bios.dev]]></copyright>
		<language><![CDATA[en]]></language>
		<atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
		<itunes:author>bios.dev</itunes:author>
		<itunes:summary>YTDLPOD Test</itunes:summary>
		<itunes:type>episodic</itunes:type>
		<itunes:owner>
			<itunes:name>bios.dev</itunes:name>
			<itunes:email>joe@bios.dev</itunes:email>
		</itunes:owner>
		<itunes:explicit>Yes</itunes:explicit>
		<itunes:category text="Business"/>
		<itunes:image href="https://picsum.photos/seed/picsum/512/512"/>
${items}
	</channel>
</rss>
  `
  return xml.trim()
}
app.get(`/${rssendpiont}`, async (c) => {
  console.log("HIT!")
  const sources = db.query("SELECT rowid, * FROM sources").all()
  c.header('Content-Type', 'application/rss+xml; charset=utf-8')
  c.header('Access-Control-Allow-Origin', '*')
  
  return c.body(genXML( sources.map( (source: any) => {
    const hostedPath = encodeURI(source.filepath.replace(process.cwd(), domain))
    return { ...source, hostedPath }
  })))
  // return c.body( rssxmleg )
})


// http://localhost:3000/static/LIVE%20ALEX%20JONES,%20MUSK,%20%20TATES,%20GAETZ,%20VIVEK,%20CALACANIS,%20PBD%20%23XTownHall%20%5B1lPKqbPkeLdGb%5D.m4a
app.get('/sources/:id/download', async (c) => {
  return c.text( process.cwd() )
})

// app.get('/rsstest', (c) => {
//   c.header()
//   return c.body
// })

export default app

