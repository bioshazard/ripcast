import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { db } from './lib/db'


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

const app = new Hono()
app.use('*', logger())
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
// import { rssxmleg } from './test/rss'

const uuidNamespace = "1d16ed48-6f54-41d3-b40f-862ff0420de2" // random uuid, just need consistent hashing
const genSeedUUID = (str: string) => uuidv5(str, uuidNamespace)
const localdomain = process.env.EXT_HOST
const domain = process.env.EXT_HOST
const rssendpiont = "sources/rss"
const rsslink = `${domain}/${rssendpiont}`

const genXML = (sources: any) => {

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
  // console.log("HIT!")
  // console.log({req: c.req})
  const sources = db.query("SELECT rowid, * FROM sources").all()
  c.header('Content-Type', 'application/rss+xml; charset=utf-8')
  c.header('Access-Control-Allow-Origin', '*')
  
  return c.body(genXML( sources.map( (source: any) => {
    // const hostedPath = encodeURI(source.filepath.replace(process.cwd(), domain))
    const hostedPath = [localdomain,source.filepath].join("/")
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

export default {
  fetch: app.fetch,
  hostname: "0.0.0.0",
}

