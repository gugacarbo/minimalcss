const path = require("path");
const puppeteer = require("puppeteer");
const minimalcss = require("../index");
const fastify = require("fastify")({
  logger: false,
});
jest.setTimeout(15000);

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "examples"),
});

// Important that the URL doesn't end with .css
fastify.get("/307-css", (req, reply) => {
  reply.redirect("/redirected.css");
});

fastify.get("/307.html", (req, reply) => {
  reply.redirect(307, "/redirected.html");
});

fastify.get("/timeout.html", (req, reply) => {
  setTimeout(() => reply.send("timeout"), 300);
});

fastify.get("/timeout.css", (req, reply) => {
  setTimeout(() => reply.send("timeout"), 300);
});

let browser;

const runMinimalcss = (path, options = {}) => {
  options.browser = browser;
  options.url = `http://localhost:3000/${path}.html`;
  return minimalcss.minimize(options);
};

beforeAll(async () => {
  await fastify.listen({ port: 3000 });
  browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
});

afterAll(async () => {
  await fastify.close();
  if (browser) {
    await browser.close();
  }
});




test('cares about static styles when JavaScript disabled', async () => {
  const { finalCss } = await runMinimalcss('dynamic-css', {
    disableJavaScript: true,
  });

  expect(finalCss).toEqual('');
});


test('cares about static and dynamic styles when JavaScript enabled', async () => {
  const { finalCss } = await runMinimalcss('dynamic-css', {
    disableJavaScript: false,
  });

  expect(finalCss).toEqual('.inline{color:red}');
});
test('does not remove whitelisted css selectors', async () => {
  const { finalCss } = await runMinimalcss('whitelist-css', {
    whitelist: ['\\.icon-.*'],
  });

  expect(finalCss).toEqual('.icon-arrow{width:10px}.icon-search{width:20px}');
});



// test('leaves used @keyframes', async () => {
//   const { finalCss } = await runMinimalcss('keyframe-leaves');
//   expect(finalCss).toMatch('@keyframes RotateSlot');
// });

// ! NOT
test("handles JS errors", async () => {
  expect.assertions(1);
  try {
    await runMinimalcss("jserror");
  } catch (e) {
    expect(e.message).toMatch("Error: unhandled");
  }
});

test('handles 404 CSS file', async () => {
  expect.assertions(1);
  try {
    await runMinimalcss('404css');
  } catch (e) {
    expect(e.message).toMatch('404 on');
  }
});

test('media queries print removed', async () => {
  const { finalCss } = await runMinimalcss('media-queries-print');
  expect(finalCss).toEqual('');
});


test('removes unused @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes');
  expect(finalCss).toEqual('');
});

test('leaves used @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-leaves');
  expect(finalCss).toMatch("@font-face{font-family:'Lato';");
});

test('cares about style tags and external CSS files', async () => {
  // The css-in-js fixture has external stylesheets, <style> tags,
  // and inline 'style' attributes, both present on the page and
  // injected using JavaScript.
  // This test asserts that selectors from stylesheets and <style>
  // tags are both included in the final CSS, while rules from
  // inline 'style' attributes are NOT included.
  const { finalCss } = await runMinimalcss('css-in-js', {
    styletags: true,
  });
  expect(finalCss).toEqual('.cssinjs1,.external,.inline{color:red}');
});


test('removes unused @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes');
  expect(finalCss).toEqual('');
});

test('leaves used pseudo classes', async () => {
  const { finalCss } = await runMinimalcss('pseudo-classes');
  expect(finalCss).toMatch('a:active');
  expect(finalCss).toMatch('a:focus');
  expect(finalCss).toMatch('a:hover');
  expect(finalCss).toMatch('a:visited');
  expect(finalCss).toMatch('input:disabled');
});

test('handles 307 CSS file', async () => {
  const { finalCss } = await runMinimalcss('307css');
  expect(finalCss).toEqual('p{color:violet}');
});
test.skip('leaves used inline @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes-inline');
  expect(finalCss).toMatch('@keyframes RotateSlot');
});



test('media queries', async () => {
  const { finalCss } = await runMinimalcss('media-queries');
  expect(finalCss).toMatch('@media only screen and (min-device-width:414px)');
  expect(finalCss).toMatch('@media only screen and (min-device-width:375px)');
});

test('evaluate DOM multiple times', async () => {
  const { finalCss } = await runMinimalcss('evaluate-dom-multiple-times');
  expect(finalCss).toMatch('.SomeSelector');
  expect(finalCss).toMatch('.OtherSelector');
});

test('form elements', async () => {
  const { finalCss } = await runMinimalcss('form-elements');
  expect(finalCss).toMatch('input[type=radio]:checked');
  expect(finalCss).toMatch('input[type=checkbox]:checked');
  expect(finalCss).toMatch('option:selected');
});

test('nested selectors and domLookupsTotal', async () => {
  const { finalCss } = await runMinimalcss('nested-selectors');
  expect(finalCss).toMatch('#foo p{color:red}');
});
test('ignoreCSSErrors', async () => {
  const { finalCss } = await runMinimalcss('invalid-css', {
    ignoreCSSErrors: true,
  });
  expect(finalCss).toEqual('');
});

test('ignoreJSErrors', async () => {
  const { finalCss } = await runMinimalcss('jserror', {
    ignoreJSErrors: true,
  });
  expect(finalCss).toEqual('');
});



test("cares only about external CSS files", async () => {
  // The css-in-js fixture has external stylesheets, <style> tags,
  // and inline 'style' attributes, both present on the page and
  // injected using JavaScript.
  // This test asserts that selectors from <style> tags and
  // inline 'style' attributes are NOT included in the final CSS.
  const { finalCss } = await runMinimalcss("css-in-js");
  expect(finalCss).toEqual(".external{color:red}");
});
test("handles relative paths", async () => {
  const { finalCss } = await runMinimalcss("css-relative-path");
  expect(finalCss).toMatch("background:url(/images/small.jpg)");
  expect(finalCss).toMatch("background-image:url(/images/small.jpg)");
  expect(finalCss).toMatch(
    "background:url(http://127.0.0.1:3000/images/small.jpg)"
  );
  expect(finalCss).toMatch(
    "background-image:url(http://127.0.0.1:3000/images/small.jpg)"
  );
  expect(finalCss).toMatch(
    "background-image:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)"
  );
});

test('invalid css', async () => {
  expect.assertions(1);

  try {
    await runMinimalcss('invalid-css');
  } catch (error) {
    const expectedUrl = 'http://localhost:3000/invalid-css.css';
    const expectedInvalidCSS = '$body';
    expect(error.toString()).toMatch(
      `Invalid CSS found while evaluating ${expectedUrl}: "${expectedInvalidCSS}"`
    );
  }
});


test('handles 307 HTML file', async () => {
  const { finalCss } = await runMinimalcss('307');
  expect(finalCss).toEqual('p{color:violet}');
});


test('order matters in multiple style sheets', async () => {
  // In inheritance.html it references two .css files. The
  // second one overrides the first one. But it's not a 100% overlap,
  // as the first one has some rules of its own.
  const { finalCss } = await runMinimalcss('inheritance');
  expect(finalCss).toEqual('p{color:violet;font-size:16px;font-style:italic}');
});

test('order matters in badly repeated style sheets', async () => {
  // In repeated-badly.html it references two .css files. One
  // of them repeated!
  // It looks like this:
  //  <head>
  //    <link rel=stylesheet href=second.css>
  //    <link rel=stylesheet href=first.css>
  //    <link rel=stylesheet href=second.css>
  //  </head>
  // This is clearly bad. The 'first.css' overrides 'second.css' but then
  // 'second.css' overrides again.
  // You should not do your HTML like this but it can happen and minimalcss
  // should cope and not choke.
  // If you open repeated.html in a browser, the rules
  // from repeated-second.css should decide lastly.
  const { finalCss } = await runMinimalcss('repeated');
  expect(finalCss).toEqual('p{color:violet;font-size:16px;font-style:italic}');
});

test.skip('handles css variables', async () => {
  const { finalCss } = await runMinimalcss('css-variables');
  expect(finalCss).toMatch('--main-bg-color:');
  expect(finalCss).not.toMatch('--unused-color:');
});

test('handles vendor prefixed properties', async () => {
  const { finalCss } = await runMinimalcss('vendor-prefixes');
  expect(finalCss).toMatch('-webkit-transition');
  expect(finalCss).toMatch('abracadabra');
});

test('leaves GET params in urls', async () => {
  const { finalCss } = await runMinimalcss('get-params-in-url');
  expect(finalCss).toMatch('/images/small.jpg?a=b');
});

test('avoids link tags that is css data', async () => {
  const { finalCss } = await runMinimalcss('css-in-link-tag');
  // Most important is that it doesn't crash.
  // See https://github.com/peterbe/minimalcss/issues/158
  expect(finalCss).toMatch('');
});



test('accept CSSO options', async () => {
  const cssoOptions = {};
  let { finalCss } = await runMinimalcss('comments', { cssoOptions });
  expect(finalCss).toMatch('test css comment');

  cssoOptions.comments = false;
  ({ finalCss } = await runMinimalcss('comments', { cssoOptions }));
  expect(finalCss).not.toMatch('test css comment');
});

test('handles extra semicolons', async () => {
  // Extra semicolons can cause csso.minify() to throw:
  // [TypeError: Cannot read property '0' of undefined]
  // https://github.com/peterbe/minimalcss/issues/243
  // https://github.com/css/csso/issues/378
  const { finalCss } = await runMinimalcss('extra-semicolons');
  expect(finalCss).toMatch('a{color:red}');
});

test('timeout error for page', async () => {
  expect.assertions(2);
  try {
    await runMinimalcss('timeout', { timeout: 200 });
  } catch (e) {
    expect(e.message).toMatch('Navigation timeout of 200 ms exceeded');
    expect(e.message).toMatch('For http://localhost:3000/timeout.html');
  }
});

test('timeout error for resources', async () => {
  expect.assertions(2);
  try {
    await runMinimalcss('with-timeout', { timeout: 200 });
  } catch (e) {
    expect(e.message).toMatch('Navigation timeout of 200 ms exceeded');
    expect(e.message).toMatch(
      'Tracked URLs that have not finished: http://localhost:3000/timeout.css?1, http://localhost:3000/timeout.css?2'
    );
  }
});

test('handles #fragments in stylesheet hrefs', async () => {
  const { finalCss } = await runMinimalcss('url-fragment');
  expect(finalCss).toMatch('p{color:red}');
});

test('ignore resource hinted (preloaded or prefetched) css', async () => {
  const { finalCss } = await runMinimalcss('resource-hinted-css');
  expect(finalCss).toMatch('p{color:red}');
});





test("deliberately skipped .css shouldn't error", async () => {
  const { finalCss } = await runMinimalcss('skippable-stylesheets', {
    skippable: (request) => {
      return request.url().search(/must-skip.css/) > -1;
    },
  });
  expect(finalCss).toEqual('p{color:brown}');
});

test('ignore 404 CSS file when `ignoreRequestErrors` is enabled', async () => {
  const { finalCss } = await runMinimalcss('404css-ignore', {
    ignoreRequestErrors: true,
  });

  expect(finalCss).toEqual('p{color:red}');
});



test.skip('leaves used inline @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes-inline');
  expect(finalCss).toMatch("@font-face{font-family:'Lato';");
});

test("deliberately skipped .css shouldn't error", async () => {
  const { finalCss } = await runMinimalcss('skippable-stylesheets', {
    skippable: (request) => {
      return request.url().search(/must-skip.css/) > -1;
    },
  });
  expect(finalCss).toEqual('p{color:brown}');
});


