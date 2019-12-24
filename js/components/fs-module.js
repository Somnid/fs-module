customElements.define("fs-module",
	class extends HTMLElement {
		constructor() {
			super();
			this.bind(this);
		}
		
		bind(element) {
			element.attachEvents = element.attachEvents.bind(element);
			element.cacheDom = element.cacheDom.bind(element);
			element.render = element.render.bind(element);
			element.enable = element.enable.bind(element);
		}
		render() {
			this.attachShadow({ mode: "open" });
			this.shadowRoot.innerHTML = `
				<div>
					<p>Please click here and select your web root to enabled filesystem modules.</p>
					<button id="enable">Enable</button>
				</div>
			`;
		}
		connectedCallback() {
			//setup some precondition
			this.render();
			this.cacheDom();
			this.attachEvents();
		}
		cacheDom() {
			this.dom = {
				enable: this.shadowRoot.querySelector("#enable")
			};
		}
		attachEvents() {
			this.dom.enable.addEventListener("click", this.enable);
		}
		async enable(){
			this.handle = await window.chooseFileSystemEntries({ type: "openDirectory" });
			const files = (await readDirectoryRecursive(this.handle))
							.map(([file, path]) => [file, "/" + path.split("/").slice(2).join("/")]); //remove the root directory from the path as it's not necessary

			const scriptsToFix = Array.from(document.querySelectorAll("script"))
				.filter(s => /^file:\/\//.test(normalizePath(s.src)) && s.type === "module")
				.map(s => s.src);

			scriptsToFix.forEach(async script => {
				const url = await fixScript(script, files);
				const scriptElement = document.createElement("script");
				scriptElement.type = "module";
				scriptElement.src = url;
				scriptElement.onload = () => {
					URL.revokeObjectURL(url); //clean up after use
				};
				document.body.appendChild(scriptElement);
			});
		}
	}
);

const normalizePath = path => new URL(path, document.location).toString();

//This will check import statements and replace the url with a generated url based on file system matches.
async function fixScript(script, files){
	script = normalizePath(script);
	const map = new Map();
	const file = findFileForScript(script, files);
	const fileText = await file.text();
	const matches = fileText.match(/(?<=import.*from\s+['"`])(.*)(?=['"`][;\n])/gu);
	if(matches && matches.length > 0){
		for(let mod of matches){
			map.set(mod, await fixScript(mod, files));
		}
	}
	const patchedFileText = fileText.replace(/(?<=import.*from\s+['"`])(.*)(?=['"`][;\n])/gu, moduleScriptUrl => map.get(moduleScriptUrl));
	return  URL.createObjectURL(new Blob([patchedFileText], { type: "application/javascript" }));
}

//This recursively grabs all the file entries but returns tuples including the path because we also need that for matching the paths
async function readDirectoryRecursive(handle, path = ""){
	const files = [];
	const entries = await handle.getEntries();
	for await(let entry of entries){
		if(entry.isDirectory){
			files.push(...await readDirectoryRecursive(entry, path + "/" + handle.name));
		} else{
			files.push([await entry.getFile(), path + "/" + handle.name + "/" + entry.name]);
		}
	}
	return files;
}

function findFileForScript(script, files){
	const matches = files.filter(([file, path]) => script.endsWith(path));
	if(!matches || matches.length === 0){
		throw new Error(`Could not find file ${script} present in the selected directory.`);
	}
	return matches.reduce((longest, current) => current.length > longest.length ? current : longest)[0]; //the longest is the most correct match but I don't think we can ever know the exact match?
}

//Check if there are any files that would be loaded from file:// and are also type module and if so load in the element.
document.addEventListener("DOMContentLoaded", () => {
	const scriptsToFix = Array.from(document.querySelectorAll("script"))
		.filter(s => /^file:\/\//.test(normalizePath(s.src)) && s.type === "module");
	if (scriptsToFix.length > 0) {
		document.body.appendChild(document.createElement("fs-module"));
	}
});
