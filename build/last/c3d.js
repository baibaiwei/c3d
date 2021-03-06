
var c3d = c3d || {};

c3d.Scene = function(opts) {

	this.animationSpeeds = {
		camera: 1
	};

	this.cameraOrbit = {
		x: 0,
		y: 0,
		z: 1500
	};

	this.shading = {
		flat: false
	};

	this.namespace = "c3d_";

	this.modelDir = "models/";

	this.perspective = 1000;

	// apply options
	for (var k in opts) {
		this[k] = opts[k];
	}

	this.cssStyles = {
		scene: [
			[c3d.cssVendorPrefix, "perspective: ", this.perspective, ";"].join(""),
			[c3d.cssVendorPrefix, "transform-style: preserve-3d;"].join(""),
			"position: absolute;",
			"background-color: transparent;"
		].join(""),

		camera: [
			[c3d.cssVendorPrefix, "transform-style: preserve-3d;"].join(""),
			[c3d.cssVendorPrefix, "perspective-origin: 50% 50%;"].join(""),
			[c3d.cssVendorPrefix, "transition: all ", this.animationSpeeds.camera, "s ease-in-out;"].join(""),
			"position: absolute;",
			"width: 100%;",
			"height: 100%;"
		].join(""),

		face: [
			"position: absolute;",
			"top: 50%;",
			"left: 50%;"
		].join("")
	};

	this.modelName = "";

	this.displayWidth = 0;
	this.displayHeight = 0;

	this.camera = null;
	this.setupCamera();
	this.geometry = new THREE.Geometry();

	this.sceneEl = document.createElement("div");

	this.sceneEl.setAttribute("class", this.namespace + "scene");
	this.camera.htmlEl.setAttribute("class", this.namespace + "camera");

	this.sceneEl.appendChild(this.camera.htmlEl);

	this.htmlEl = this.sceneEl;
	this.htmlEl.style.cssText += this.cssStyles.scene;

	return this;
};

c3d.Scene.prototype = {

	getGeometryDimensions: function() {
		var bbox = this.geometry.boundingBox;
		return {
			width: bbox.max.x - bbox.min.x,
			height: bbox.max.y - bbox.min.y,
			depth: bbox.max.z - bbox.max.z
		};
	},

	setFaceContent: function(faceIndex, contentHtml) {
		var face = this.geometry.faces[faceIndex];

		face.contentEl.innerHTML = contentHtml;

		return this;
	},

	setCameraOrbit: function(x, y, z) {
		this.cameraOrbit = {x: x, y: y, z: z};
	},

	setDisplaySize: function(width, height) {
		// sets/updates scene dimensions
		this.displayWidth = width;
		this.displayHeight = height;
	},

	setupCamera: function() {
		var camera = [];

		camera = new THREE.Camera(35, 1, 1, 10000);
		camera.position = new THREE.Vector3(this.cameraOrbit.x, this.cameraOrbit.y, this.cameraOrbit.z);

		camera.htmlEl = document.createElement("div");
		this.camera = camera;

		this.camera.htmlEl.style.cssText += this.cssStyles.camera;

		return this;
	},

	loadModel: function(modelName, afterLoadCallback) {
		this.modelName = modelName;
		var path  = this.modelDir + this.modelName + ".json";
		var loader = new THREE.JSONLoader();
		
		var that = this;

		loader.load(path, function(geometry) {
			that.setGeometry(geometry);
			afterLoadCallback(that);
			that.render();
		}, "");

		return this;
	},

	setGeometry: function(geometry) {
		this.geometry = geometry;
		this.geometry.computeBoundingBox();

		var faces = geometry.faces;
		var vertices = geometry.vertices;

		for (var faceIndex = 0; faceIndex < faces.length; faceIndex++) {
			var face = faces[faceIndex];
			var faceVertices = {a: vertices[face.a], b: vertices[face.b], c: vertices[face.c], d: vertices[face.d]};
			var centroid = face.centroid;

			var yAxis = new THREE.Vector3().sub(faceVertices.d, faceVertices.c);
			var xAxis = new THREE.Vector3().sub(faceVertices.b, faceVertices.c);

			var width = xAxis.length(), height = yAxis.length();
			
			yAxis.normalize();
			xAxis.normalize();
			
			var transformationMatrixArr = [
				xAxis.x,	xAxis.y,	xAxis.z,	0,
				yAxis.x,	yAxis.y,	yAxis.z,	0,
				0,			0,			1,			0,
				centroid.x, centroid.y, centroid.z, 1
			];
	
			face.width = width;
			face.height = height;
			face.index = faceIndex;

			face.htmlEl = drawFace(width, height, this.cssStyles.face, this.namespace);
			face.htmlEl = setFaceMatrix(face.htmlEl, transformationMatrixArr);
			face.contentEl = null;
			face.timeouts = [];

			this.camera.htmlEl.appendChild(face.htmlEl);
		}

		function setFaceMatrix(face, matrix) {
			var cssMatrix = new Array(matrix.length);
			for (var i = 0; i < matrix.length; i++) {
				cssMatrix[i] = c3d.toFixed(matrix[i]);
			}
			face.style[c3d.cssVendorPrefix + "transform"] = "matrix3d(" + cssMatrix.join(",") + ")";
			return face;
		}
		
		function drawFace(width, height, styles, namespace) {
			var container = document.createElement("div");
			container.style.width = width + "px";
			container.style.height = height + "px";
			container.style.marginLeft = (-width / 2) + "px";
			container.style.marginTop = (-height/ 2) + "px";
			container.setAttribute("class", namespace + "face");
			container.style.cssText += styles;
			return container;
		}
		return this;
	},

	render: function() {
		this.camera.updateMatrixWorld(true);
		this.camera.updateMatrix();

		var m = new THREE.Matrix4().getInverse(this.camera.matrixWorld.clone()).elements;
		var htmlMatrix = new Array(m.length);

		var matrix = [
			m[0],	-m[1],	m[2],	m[3],
			m[4],	-m[5],	m[6],	m[7],
			m[8],	-m[9],	m[10],	m[11],
			m[12],	-m[13],	m[14],	m[15]
		];

		// expand scientific notations
		for (var i = 0; i < matrix.length; i++) {
			htmlMatrix[i] = c3d.toFixed(matrix[i]);
		}

		// apply to matrix
		this.camera.htmlEl.style[c3d.cssVendorPrefix + "transform"] = "matrix3d(" + htmlMatrix.join(",") + ")";

		// render shadows
		if (this.shading.flat === true) {
			this.flatShading();
		}

		return this;
	},

	moveCameraToOrbit: function() {
		var camera = this.camera;
		var timeout = 0;
		var that = this;
		var cameraOrbit = new THREE.Vector3(this.cameraOrbit.x, this.cameraOrbit.y, this.cameraOrbit.z);

		if (!camera.position.equals(cameraOrbit)) {
			// move to orbit
			camera.position = cameraOrbit;
			camera.rotation = new THREE.Vector3();
			camera.lookAt(new THREE.Vector3(0, 0, 0));
			this.render();

			timeout = this.animationSpeeds.camera;
		}
		this.lastAnimationTimeout = timeout;

		return this;
	},

	flatShading: function() {
		var faces = this.geometry.faces;
		var camera = this.camera;
		var light = this.camera.position;
		var ambient = 0.1;
		var lightIntensity = 10000;

		for (var i = 0; i < faces.length; i++) {
			var face = faces[i];
			var centroid = face.centroid;
			var lightVector = new THREE.Vector3().sub(centroid, light);
			var faceNormal = face.normal.clone();

			// calculate angle between face normal and lightvector
			var angle = Math.acos(lightVector.dot(faceNormal) / (lightVector.length() * faceNormal.length()));
			var intensity = 1 - Math.cos(angle + Math.PI / 2) * -1;
			var distanceFac = 1 - (lightVector.length() / lightIntensity);
			if (distanceFac < 0)
				distanceFac = 0;

			var finalIntensity = (intensity * distanceFac) + ambient;

			var intensityCol = parseInt(finalIntensity * 255, 10);
			face.htmlEl.style["background-color"] = "rgba(" + [intensityCol, intensityCol, intensityCol].join(",") + ", 1)";
			face.lightIntensity = intensityCol;
		}

		return this;
	}
};
var c3d = c3d || {};

c3d.cssVendorPrefix = (function(undefined) {
	var prefixes = ["Moz", "ms", "O", "Webkit"];
	var testEl = document.createElement('div');

	for (var i = prefixes.length - 1; testEl.style[prefixes[i] + "Transform"] === undefined && i > -1; i--) {
		continue;
	}

	return (i < 0) ? "" : ["-", prefixes[i].toLowerCase(), "-"].join("");
})();

c3d.toFixed = function(x) {
	// converts x from scientific notation to "normal" notation
	// e.g. function(1.3543e6) -> "1354300"
	// returns a string
	// original from http://stackoverflow.com/a/1685917, added support for negative numbers

	var neg = false, e;
	if (x < 0) {
		x *= -1;
		neg = true;
	}
	if (Math.abs(x) < 1.0) {
		e = parseInt(x.toString().split('e-')[1], 10);
		if (e) {
			x *= Math.pow(10,e-1);
			x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
		}
	} else {
		e = parseInt(x.toString().split('+')[1], 10);
		if (e > 20) {
			e -= 20;
			x /= Math.pow(10,e);
			x += (new Array(e+1)).join('0');
		}
	}
	if (neg) x = "-" + x;
	return x;
};