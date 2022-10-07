var zipMods = [];
var pkgMods = [];

let _fs = BrowserFS.BFSRequire("fs");
let _path = BrowserFS.BFSRequire("path");
let Buffer = BrowserFS.BFSRequire("buffer").Buffer;

zipMods = [["hldm.zip", "HLDM (64M)", 64654514]];

aczMods = [["hldm-cache.html", "HLDM (64M)", 64654514]];

pkgMods = [["hldm.js", "HLDM (85M)"]];

const LAST_VERSION = "1.1";

const MIRROR_BASE_URL =
  "https://raw.githubusercontent.com/hyphenized/hl-emscriptem/master";
const models_path = "/models/player";
const models = [
  "pedrocastillo",
  "panteradelcallao",
  "paltaemocionada",
  "lapadula",
  "huacoerotico",
  "hinchaisraelita",
  "felipeelterrible",
  "estudiasonso",
  "esqueletovenezolano",
  "arqueroredmayne",
  "antauro",
  "coneableuno",
  "coneabledos",
  "cryptobro",
];

var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var asyncDialog = document.getElementById("asyncDialog");
var myerrorbuf = "";
var myerrordate = new Date();
var mounted = false;
var gamedir = "valve";
var moduleCount = 0;
var mem = 150;
var mfs;
var zipSize;

// make BrowserFS to work on ES5 browsers
if (!ArrayBuffer["isView"]) {
  ArrayBuffer.isView = function (a) {
    return (
      a !== null && typeof a === "object" && a["buffer"] instanceof ArrayBuffer
    );
  };
}

showElement("optionsTitle", false);

async function fetchZIP(packageName, cb) {
  const mirrorURL = MIRROR_BASE_URL + "/static/hldm.zip";

  const response = await fetch(mirrorURL).catch(() => fetch(packageName));

  const reader = response.body.getReader();
  const chunks = [];

  const contentLength = +response.headers.get("Content-Length");
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }
    chunks.push(value);
    received += value.length;
    if (Module["setStatus"])
      Module["setStatus"](
        "Downloading data... (" + received + "/" + contentLength + ")"
      );
  }

  const bytes = new Uint8Array(received);

  chunks.reduce((pos, chunk) => {
    bytes.set(chunk, pos);
    return pos + chunk.length;
  }, 0);

  return bytes.buffer;
}

function prepareSelects() {}

try {
  mem = Math.round(window.location.hash.substring(1)) || 150;
} catch (e) {}

var Module = {
  TOTAL_MEMORY: mem * 1024 * 1024,
  preRun: [],
  postRun: [],
  print: (function () {
    var element = document.getElementById("output");
    if (element) element.value = ""; // clear browser cache
    return function (text) {
      if (arguments.length > 1)
        text = Array.prototype.slice.call(arguments).join(" ");

      if (text) myerrorbuf += text + "\n";
      if (element) {
        if (element.value.length > 65536)
          element.value = element.value.substring(512) + myerrorbuf;
        else element.value += myerrorbuf;
        element.scrollTop = element.scrollHeight; // focus on bottom
      }
      myerrorbuf = "";
    };
  })(),
  printErr: function (text) {
    if (arguments.length > 1)
      text = Array.prototype.slice.call(arguments).join(" ");
    if (0) {
      // XXX disabled for safety typeof dump == 'function') {
      dump(text + "\n"); // fast, straight to the real console
    } else {
      if (myerrorbuf.length > 2048)
        myerrorbuf = "some lines skipped\n" + myerrorbuf.substring(512);
      myerrorbuf += text + "\n";
      if (new Date() - myerrordate > 3000) {
        myerrordate = new Date();
        Module.print();
      }
    }
  },
  canvas: (function () {
    var canvas = document.getElementById("canvas");

    // As a default initial behavior, pop up an alert when webgl context is lost. To make your
    // application robust, you may want to override this behavior before shipping!
    // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
    canvas.addEventListener(
      "webglcontextlost",
      function (e) {
        alert("WebGL context lost. You will need to reload the page.");
        e.preventDefault();
      },
      false
    );

    return canvas;
  })(),
  setStatus: function (text) {
    if (!Module.setStatus.last)
      Module.setStatus.last = { time: Date.now(), text: "" };
    if (text === Module.setStatus.text) return;
    if (new Date() - myerrordate > 3000) {
      myerrordate = new Date();
      Module.print();
    }

    statusElement.innerHTML = text;
    if (progressElement) {
      var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);

      if (m) {
        var progress = Math.round((parseInt(m[2]) * 100) / parseInt(m[4]));
        progressElement.style.color = progress > 5 ? "#303030" : "#aaa000";
        progressElement.style.width = progressElement.innerHTML =
          "" + progress + "%";
      }
      showElement("progress1", !!m);
    }
  },
  totalDependencies: 0,
  monitorRunDependencies: function (left) {
    this.totalDependencies = Math.max(this.totalDependencies, left);
    if (left)
      Module.setStatus(
        "Preparing... (" +
          (this.totalDependencies - left) +
          "/" +
          this.totalDependencies +
          ")"
      );
  },
};

function handleWindowError(error) {
  if (mounted)
    FS.syncfs(false, function (err) {
      Module.print("Saving IDBFS: " + err);
    });

  if (("" + error).indexOf("SimulateInfiniteLoop") > 0) {
    return;
  }
  var text = "Exception thrown: " + error;
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace("\n", "<br>", "g");
  Module.setStatus(text);
  Module.print("Exception thrown: " + error);
}

window.onerror = handleWindowError;

function haltRun() {}

var savedRun;

function radioChecked(id) {
  var r = document.getElementById("r" + id);
  if (r) return r.checked;
  return false;
}

function showElement(id, show) {
  var e = document.getElementById(id);
  if (!e) return;
  e.style.display = show ? "block" : "none";
}
Module.setStatus("Downloading...");

function fsReadAllFiles(folder) {
  const files = [];

  function impl(curFolder) {
    for (const name of FS.readdir(curFolder)) {
      if (name === "." || name === "..") continue;

      const path = `${curFolder}/${name}`;
      const { mode, timestamp } = FS.lookupPath(path).node;
      if (FS.isFile(mode)) {
        files.push({ path, timestamp });
      } else if (FS.isDir(mode)) {
        impl(path);
      }
    }
  }

  impl(folder);
  return files;
}

const getUtilPromise = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return [promise, resolve];
};

const loadAndMountGameData = async () => {
  let dataExists = false;
  const [syncPromise, syncResolve] = getUtilPromise();
  const [resultPromise, resultResolve] = getUtilPromise();

  FS.mount(IDBFS, { root: "/" }, "/rodir");
  FS.syncfs(true, function (err) {
    if (err) Module.print("Loading IDBFS: " + err);
    else Module.print("Loaded IDBFS contents");
    syncResolve();
  });
  mounted = true;

  await syncPromise;

  try {
    // debugger;
    if (FS.lookupPath("/rodir/valve/config.cfg")) {
      dataExists = true;
    }
  } catch {
    // FS.unmount("/rodir");
  }

  if (dataExists && getVersion() === LAST_VERSION) return resultResolve();

  if (!dataExists) {
    const data = await fetchZIP("hldm.zip");

    FS.mkdir("/zip");

    mfs.mount("/zip", new BrowserFS.FileSystem.ZipFS(Buffer.from(data)));

    FS.mount(new BrowserFS.EmscriptenFS(), { root: "/zip" }, "/zip");

    // FS.mkdir("/setup");
    // FS.mount(IDBFS, { root: "/" }, "/rodir");

    FS.chdir("/rodir");
    // copy all files
    for (const { path: pathname } of fsReadAllFiles("/zip")) {
      const _pathname = _path.relative("/zip", pathname);
      const parentDir = _path.dirname(_pathname);

      const file = FS.readFile(pathname, { encoding: "binary" });
      try {
        FS.mkdirTree("/rodir/" + parentDir);
        FS.writeFile(_pathname, file, { encoding: "binary" });
      } catch (error) {
        // console.trace(error)
        // TODO: NOTIFY NO SPACE AVAILABLE
      }
    }
  }

  // update
  Module.setStatus("Loading models...");
  function toBuffer(ab) {
    const buf = Buffer.alloc(ab.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
      buf[i] = view[i];
    }
    return buf;
  }

  const allModels = await Promise.all(
    models.map(async (model) => {
      const path = `/models/player/${model}/${model}`;
      const bmpUrl = `/models/player/${model}/${model}.bmp`;
      const mdlUrl = `/models/player/${model}/${model}.mdl`;

      const bmp = await fetch(MIRROR_BASE_URL + "/static" + bmpUrl)
        .catch(() => fetch(bmpUrl))
        .then((resp) => resp.arrayBuffer());
      const mdl = await fetch(MIRROR_BASE_URL + "/static" + mdlUrl)
        .catch(() => fetch(mdlUrl))
        .then((resp) => resp.arrayBuffer());

      return [path, toBuffer(bmp), toBuffer(mdl)];
    })
  );

  for (const [path, bmp, mdl] of allModels) {
    FS.mkdirTree("/rodir/valve" + path);
    FS.writeFile("/rodir/valve" + path + ".bmp", bmp, { encoding: "binary" });
    FS.writeFile("/rodir/valve" + path + ".mdl", mdl, { encoding: "binary" });
  }

  FS.syncfs(false, function (err) {
    if (err) Module.print("Loading IDBFS: " + err);
    else Module.print("Saved game data to IDBFS!");

    setVersion(LAST_VERSION);
    resultResolve();
  });

  // FS.unmount("/rodir");
  // FS.rmdir("/setup");

  // FS.mount(IDBFS, { root: "/" }, "/rodir");
  FS.chdir("/xash/");

  return resultPromise;
};

function startXash({ name, model, args }) {
  showElement("loader1", false);
  showElement("optionsTitle", false);
  showElement("fSettings", false);
  setupFS();
  Module.arguments = args.split(" ");
  Module.run = run = savedRun;

  loadAndMountGameData().then(async () => {
    // setup name and chosen model
    const models = [...form.querySelectorAll("[name=model] option")].map(
      (el) => el.value
    );

    const chosenModel =
      model == "random" ? models[(Math.random() * models.length) | 0] : model;
    const sanitizedName = name.replace(/[^a-zA-Z0-9 _\-?]/g, "?");

    const data = FS.readFile("/rodir/valve/config.cfg", { encoding: "utf8" })
      .replace(/^model "[a-zA-Z0-9 _\-?]+"$/m, `model "${chosenModel}"`)
      .replace(/^name "[a-zA-Z0-9 _\-?]+"$/m, `name "${sanitizedName}"`);

    FS.writeFile("/rodir/valve/config.cfg", data, { encoding: "utf8" });

    const [syncing, resolve] = getUtilPromise();

    FS.syncfs(false, () => resolve());

    await syncing;

    console.log("runs", name, model, args);
    savedRun();

    showElement("canvas", true);

    window.addEventListener("beforeunload", function (e) {
      var confirmationMessage = "Leave the game?";

      (e || window.event).returnValue = confirmationMessage; //Gecko + IE
      return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
    });
  });
}

function setupFS() {
  FS.mkdir("/rodir");
  FS.mkdir("/xash");
  try {
    mfs = new BrowserFS.FileSystem.MountableFileSystem();
    BrowserFS.initialize(mfs);
  } catch (e) {
    mfs = undefined;
    Module.print("Failed to initialize BrowserFS: " + e);
  }

  mfs.mount("/ls", new BrowserFS.FileSystem.LocalStorage());
  FS.mount(new BrowserFS.EmscriptenFS(), { root: "/ls" }, "/xash");
  Module.print("LocalStorage mounted");

  // FS.chdir("/xash/");
}

function skipRun() {
  savedRun = run;
  Module.run = haltRun;
  run = haltRun;

  Module.setStatus("Engine downloaded!");
  showElement("loader1", false);
  showElement("optionsTitle", true);

  if (
    window.indexedDB ||
    window.mozIndexedDB ||
    window.webkitIndexedDB ||
    window.msIndexedDB
  )
    showElement("idbHider", true);
  prepareSelects();
  showElement("fSettings", true);

  ENV.XASH3D_GAMEDIR = gamedir;
  ENV.XASH3D_RODIR = "/rodir";

  function loadModule(name) {
    var script = document.createElement("script");
    script.onload = function () {
      moduleCount++;
      if (moduleCount == 3) {
        Module.setStatus("Scripts downloaded!");
      }
    };
    document.body.appendChild(script);
    script.src = name + ".js";
  }

  loadModule("server");
  loadModule("client");
  loadModule("menu");
}

const getHost = () => {
  const host = window.location.hostname;
  return `wsproxy://${host}:3200/`;
};

Module.preInit = [skipRun];
Module.websocket = [];
Module.websocket.url = getHost();
ENV = [];

const form = document.getElementById("fSettings");
form.elements["args"].value = new URLSearchParams(location.search).get("args");

form.onsubmit = (e) => {
  e.preventDefault();
  showElement("playermodels", false);
  console.log("started");
  startXash({
    name: form.elements["player"].value || "Player",
    model: form.elements["model"].value || "random",
    args: form.elements["args"].value || "",
  });
};

const modelPicutreOptionTemplate = ({ modelName }) => `
  <div class="model" data-model="${modelName}">
    <img src="models/player/${modelName}/${modelName}.bmp" alt="${modelName}_Model" class="model__cover" draggable="false">
  </div>
`;
const modelsPicturesContainer = document.getElementById("playermodels");
const handleModelPictureClick = (e) => {
  e.stopPropagation();
  const target = e.target;
  const element = target.tagName == "IMG" ? target.parentElement : target;
  form.elements["model"].value = element.dataset.model;
};

for (const model of models) {
  const opt = document.createElement("option");
  opt.value = model;
  opt.text = model;
  form.elements["model"].appendChild(opt);

  let dummy = document.createElement("div");
  dummy.innerHTML = modelPicutreOptionTemplate({ modelName: model });
  dummy.firstElementChild.addEventListener("click", handleModelPictureClick);

  modelsPicturesContainer.prepend(dummy.firstElementChild);
}

document
  .getElementById("random-model")
  .addEventListener("click", handleModelPictureClick);

const VERSION_KEY = "__VER";

function getVersion() {
  const version = localStorage.getItem(VERSION_KEY);
  if (version == null) {
    localStorage.setItem(VERSION_KEY, JSON.stringify(1));
    return "1";
  }

  return version;
}

function setVersion(version) {
  localStorage.setItem(VERSION_KEY, JSON.stringify(version));
  return version;
}
