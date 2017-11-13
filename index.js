const puppeteer = require("puppeteer");
const prompt = require("prompt");
const fs = require("fs");
const shell = require("shelljs");
const path = require("path");
const moment = require("moment");
const DownloadProgress = require("download-progress");

const schema = {
  properties: {
    username: {
      required: true
    },
    password: {
      hidden: true,
      required: true
    },
    outpath: {
      required: true
    },
    modules: {
      required: true,
      message: "JSON array of strings of substring matching module name",
      pattern: /\[(\".+\")+]/
		}
	}
};

prompt.start();

prompt.get(schema, (err, result) => {
	if (err) throw err;
	const MODULES = JSON.parse(result.modules);

	(async () => {
		const browser = await puppeteer.launch({headless:false});
		const page = await browser.newPage();
		// page.on('console', msg => console.log('PAGE LOG:', ...msg.args));

		await page.goto('https://vle.shef.ac.uk');

		await page.type('#user_id', result.username);
		await page.type('#password', result.password);
		await page.click('#entry-login');
		await page.waitForSelector('.portletList-img.courseListing.coursefakeclass.u_indent > li > a');
		const modulePages = await page.$$eval(".portletList-img.courseListing.coursefakeclass.u_indent > li > a", (links, MODULES) => {
			const keep = [];
			for (link of links) {
				for (module of MODULES) {
					if (link.text.toLowerCase().indexOf(module.toLowerCase()) !== -1) {
						const course_id = link.href.split('id=')[1].split('&')[0];
						keep.push({
							url: `https://vle.shef.ac.uk/webapps/osc-BasicLTI-BBLEARN/frame.jsp?course_id=${course_id}&mode=view&id=encore&globalNavigation=false`,
							module: link.text,
              query: module
						});
						break;
					}
				}
			}

			return keep;
		}, MODULES);
		// console.log(modulePages);

		const modules = await modulePages.map(async data => {
			const { module, url, query } = data;

			const tab = await browser.newPage();
			await tab.goto(url);

			await tab.waitForSelector('.menu.centered');
			await tab.$eval('.menu.centered', btn => btn.click());

			await tab.waitForSelector('a[aria-label="Class list"]');
			await tab.$eval('a[aria-label="Class list"]', a => a.click());

			// page $('.main-content > script')[1].innerText.split('Echo["classroomApp"]("')[1].split('      });\n')[0]
			// JSON.parse($('.main-content > script')[1].innerText.split('["classroomApp"]("')[1].split('");\n        });')[0].replace(/\\/g, ""))

			await tab.waitForSelector('.date-time');
			const lectures = await tab.$$eval('.date-time', dts => {
				const lecs = [];
				let i = 0;
				for (dt of dts) {
					if (dt.nextSibling.className === "media-icons centered video") {
						lecs.push({ index: i, date: dt.children[0].innerText, time: dt.children[1].innerText });
					}
					i++;
				}
				return lecs;
			});
			// console.log(lectures);

			await tab.waitForSelector('a[aria-label="Class list"]');
			await tab.$eval('a[aria-label="Class list"]', a => a.click());
			for (let l = 0; l < lectures.length; l++) {
				const lecture = lectures[l];

				await tab.waitForSelector('a[aria-label="Class list"]');
				await tab.$eval('a[aria-label="Class list"]', a => a.click());
				await tab.waitForSelector('.date-time');
				await tab.$$eval('.date-time', (dts, lecture) => dts[lecture.index].click(), lecture);
				await tab.waitForNavigation();

				const json = await tab.$$eval('.main-content > script', scripts => {
					return JSON.parse(scripts[1].innerText.split('Echo["classroomApp"]("')[1].split('");\n        });')[0].replace(/\\/g, ""));
				});
				lecture.json = json;
				if (!json.video) continue;
				const videos = json.video.current.primaryFiles;

				for (video of videos) {
					if (video.s3Url.indexOf("hd1.mp4") !== -1) lecture.hd = video.s3Url;
					else if (video.s3Url.indexOf("sd1.mp4") !== -1) lecture.sd = video.s3Url;
				}
			}

			return { url, lectures, moduleName: module, query };
		});

		modules.forEach((module, i) => {
			module.then(data => {
				modules[i] = data;
			});
		});
		for (module of modules) await module;

		const baseoutpath = path.join(__dirname, path.basename(result.outpath));
		shell.mkdir(baseoutpath);
		let allDownloads = [];
		for (module of modules) {
		  const { query, lectures } = module;

		  const moduleoutpath = path.join(baseoutpath, query);
		  shell.mkdir(moduleoutpath);

		  const jsonpath = path.join(moduleoutpath, `${query}.json`);
		  const exists = shell.ls('**/*.mp4').map(filepath => path.basename(filepath));
		  fs.writeFileSync(jsonpath, JSON.stringify(module));
		  const downloads = lectures
          .sort((lec1, lec2) => moment(lec1.json.lesson.timing.start).isBefore(lec2.json.lesson.timing.start) ? -1 : 1)
          .map((lecture, i) => Object.assign(lecture, {i, filename: `${query}-${i}-${moment(lecture.json.lesson.timing.start).format("hhaDoMMMYYYY")}.mp4`}))
          .filter(lecture => {
            return exists.indexOf(lecture.filename) === -1 && !!lecture.sd;
          })
          .map(lecture => {
		        return {
		          url: lecture.sd,
              dest: path.join(moduleoutpath, lecture.filename)
            }
      });
		  allDownloads.push.apply(allDownloads, downloads);
    }
    const download = DownloadProgress(allDownloads, {});
		console.log(`Downloading ${allDownloads.length} lectures from ${MODULES}`);
    download.get(err => {
      if (err) throw new Error(err);
    });
		await browser.close();
	})();
});



