const puppeteer = require('puppeteer');
const prompt = require('prompt');
const fs = require('fs');

const schema = {
	properties: {
		username: {
			required: true
		},
		password: {
			hidden: true,
			required: true
		},
		outfile: {
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
							module: link.text
						});
						break;
					}
				}
			}

			return keep;
		}, MODULES);
		// console.log(modulePages);

		const modules = await modulePages.map(async data => {
			const { module, url } = data;

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
				var i = 0;
				for (dt of dts) {
					if (dt.nextSibling.className === "media-icons centered video") {
						lecs.push({ index: i, date: dt.children[0].innerText, time: dt.children[1].innerText });
					}
					i++;
				}
				return lecs;
			})
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
				let minw = 99999999999;
				let min;
				let maxw = 0;
				let max;

				for (video of videos) {
					if (video.width > maxw) max = video;
					if (video.width < minw) min = video;
				}

				lecture.min = min.s3Url;
				lecture.max = max.s3Url;
			}

			return { url, lectures, moduleName: module };
		});

		modules.forEach((module, i) => {
			module.then(data => {
				modules[i] = data;
			});
		});
		for (module of modules) await module;

		fs.writeFileSync(result.outfile, JSON.stringify(modules));
		await browser.close();
	})();
});



