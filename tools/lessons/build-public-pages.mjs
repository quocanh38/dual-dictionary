import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLibraryIndex, readLibraryPack } from '../../lessons/library.js';

const root = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../../', import.meta.url));
const host = 'https://hocta.app';
const read = file => fs.readFile(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFile(path.join(root, file), value, 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[char]);
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const topic = { academic: 'Academic English', workplace: 'Workplace English' };
const catalogue = readLibraryIndex(await read('lessons/library/index.json'));
const lessons = await Promise.all(catalogue.packs.map(async entry => {
  const {payload: pack} = await readLibraryPack(await read('lessons/library/' + entry.file), entry);
  if (pack.review.status !== 'approved' || pack.lessons.length !== 1) {
    throw new Error('Public lesson pages require one approved lesson per pack: ' + entry.file);
  }
  return { entry, slug: entry.file.slice(0, -5), pack, lesson: pack.lessons[0] };
}));

function publicPath(slug) { return '/lessons/' + slug + '/'; }

function render({entry, slug, pack, lesson}) {
  const url = host + publicPath(slug);
  const title = lesson.title + ' | HọcTA';
  const crumbs = [['HọcTA', '/'], ['Lessons', '/lessons/'], [lesson.title, publicPath(slug)]];
  const data = {
    '@context':'https://schema.org', '@graph':[
      { '@type':'LearningResource', name:lesson.title, description:lesson.objective, url,
        inLanguage:'en', learningResourceType:'Lesson', educationalLevel:entry.levelEstimate,
        publisher:{'@type':'Organization','@id':host+'/#organization',name:'HọcTA'} },
      { '@type':'BreadcrumbList', itemListElement:crumbs.map(([name, href], i) => ({
         '@type':'ListItem', position:i+1, name, item:host+href,
      })) },
    ],
  };
  const reading = lesson.reading.text.split(/\r?\n\s*\r?\n/).map(paragraph => '<p>' + escape(paragraph) + '</p>').join('\n');
  const targets = lesson.targets.map(target => {
    const sentence = lesson.reading.sentences.find(source => source.id === target.sourceSentenceId).text;
    return '<dt>' + escape(target.phrase) + '</dt><dd><p>' + escape(target.meaningEn) +
      '</p><p lang="vi">' + escape(target.meaningVi) + '</p><blockquote>' + escape(sentence) + '</blockquote></dd>';
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#293CC8">
<title>${escape(title)}</title>
<meta name="description" content="${escape(lesson.objective)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="HọcTA">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(lesson.objective)}">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/css/style.css">
<link rel="stylesheet" href="/lessons/lesson-ui.css">
<script type="application/ld+json">${json(data)}</script>
<script defer src="/js/section-switcher.js"></script>
</head>
<body class="lesson-page public-lesson">
<header class="section-topbar"><a href="/">HọcTA</a><div class="section-switcher" lang="vi"><button class="section-trigger" type="button" aria-label="Chuyển khu vực, hiện tại: Bài học" aria-controls="hocta-sections" popovertarget="hocta-sections">Bài học</button><nav id="hocta-sections" class="section-links" aria-label="Các khu vực HọcTA" popover><a href="/">Ứng dụng</a><a href="/lessons/">Bài học</a><a href="/vi/tu/">Từ điển</a><a href="/docs/">Hướng dẫn</a></nav></div></header>
<main id="lesson-content">
  <nav class="lesson-breadcrumb" aria-label="Breadcrumb"><a href="/lessons/">Lesson library</a></nav>
  <article>
    <h1>${escape(lesson.title)}</h1>
    <p class="meta">${topic[entry.topic]} · ${entry.levelEstimate} (estimated)</p>
    <p class="lead">${escape(lesson.objective)}</p>
    <p><a class="btn-primary" href="/lessons/#study=${encodeURIComponent(slug)}">Open exercises in HọcTA</a></p>
    <section aria-labelledby="reading">
      <h2 id="reading">Reading</h2>
      ${reading}
    </section>
    <section aria-labelledby="vocabulary">
      <h2 id="vocabulary">Vocabulary in context</h2>
      <dl>${targets}</dl>
    </section>
    <p class="meta">${pack.provenance.aiAssisted ? 'AI-assisted lesson, reviewed by an editor.' : 'Reviewed lesson.'}</p>
  </article>
</main>
</body>
</html>
`;
}

async function replaceBlock(file, name, value, insertAt) {
  const source = await read(file);
  const start = '<!-- ' + name + ':start -->';
  const end = '<!-- ' + name + ':end -->';
  const block = start + '\n' + value + '\n' + end;
  const first = source.indexOf(start);
  if (first >= 0) {
    const last = source.indexOf(end, first);
    if (last < 0) throw new Error('Missing end marker in ' + file);
    await write(file, source.slice(0, first) + block + source.slice(last + end.length));
    return;
  }
  if (!source.includes(insertAt)) throw new Error('Missing insertion marker in ' + file);
  await write(file, source.replace(insertAt, block + '\n' + insertAt));
}

for (const source of lessons) {
  const dir = path.join(root, publicPath(source.slug).slice(1));
  await fs.mkdir(dir, {recursive:true});
  await write(publicPath(source.slug).slice(1) + 'index.html', render(source));
}
const groups = Object.entries(topic).map(([id, label]) =>
  '<h3>' + label + '</h3>\n<ul>\n' + lessons.filter(({entry}) => entry.topic === id)
    .map(({slug, lesson}) => '<li><a href="' + publicPath(slug) + '">' + escape(lesson.title) + '</a></li>').join('\n') + '\n</ul>'
).join('\n');
await replaceBlock('lessons/index.html','public lessons',
  '<section id="public-lessons" aria-labelledby="public-lessons-title">\n<h2 id="public-lessons-title">Browse lessons</h2>\n' + groups + '\n</section>',
  '<div id="app">');
await replaceBlock('sitemap-pages.xml','public lessons',
  lessons.map(({slug}) => '  <url><loc>' + host + publicPath(slug) + '</loc></url>').join('\n'),
  '</urlset>');
console.log('Generated ' + lessons.length + ' public lesson pages, catalogue links and sitemap entries.');
