if (WEBGL.isWebGLAvailable() === false) {
    document.body.appendChild(WEBGL.getWebGLErrorMessage());
}

document.addEventListener("keydown", event => {
    if (event.key == 's' && event.ctrlKey) {
        event.preventDefault();
        system.getCoordinateFile();
    }
});

function getCoordinateFile() {
    let filename = `${system.getRuleStr()}.${system.cubeMap.size}-mer`;
    let text = ""
    system.cubeMap.forEach(function(value, key){text += key + '\n'});
    saveString(text, filename);
}

function exportGLTF(name='scene') {
    // Instantiate an exporter
    let exporter = new THREE.GLTFExporter();
    let options = {'forceIndices': true};

    // Parse the input and generate the glTF output
    exporter.parse(system.objGroup, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            console.log(output);
            saveString(output, `${name}.gltf`);
        }
    }, options);
}

// Adapted from https://stackoverflow.com/a/41350703
 function getSpiralCoord(n) {
    const k = Math.ceil((Math.sqrt(n) - 1) / 2);
    let t = 2 * k + 1;
    let m = Math.pow(t, 2);

    t -= 1;

    if (n >= m - t) {
        return new THREE.Vector3(0, k - (m - n), -k);
    }

    m -= t;

    if (n >= m - t) {
        return new THREE.Vector3(0, -k, -k + (m - n));
    }

    m -= t;

    if (n >= m - t) {
        return new THREE.Vector3(0, -k + (m - n), k);
    }

    return new THREE.Vector3(0, k, k - (m - n - t));
}


// Adapted from https://codeincomplete.com/articles/bin-packing/
class Packer {
    constructor(w, h) {
        console.log(`Creating new packer with w=${w} and h=${h}.`);
        this.root = {x: 0, y: 0, w: w, h: h};
    }

    fit(blocks) {
        let n, node, block;
        this.root = { x: 0, y: 0, w: blocks[0].w, h: blocks[0].h };
        for (n = 0; n < blocks.length; n++) {
            block = blocks[n];
            if (node = this.findNode(this.root, block.w, block.h)) {
                block.fit = this.splitNode(node, block.w, block.h);
            } else {
                block.fit = this.growNode(block.w, block.h);
            }
            try {
                block.obj.position.x = block.fit.x + block.w/2;
                block.obj.position.y = block.fit.y + block.h/2;
            } catch (error) {
                console.warn(`Failed to position block ${n}.`);
            }
        }
    }

    findNode(root, w, h) {
        if (root.used) {
            return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
        } else if ((w <= root.w) && (h <= root.h)) {
            return root;
        } else {
            return null;
        }
    }

    splitNode(node, w, h) {
        node.used = true;
        node.down  = {x: node.x,     y: node.y + h, w: node.w,     h: node.h - h};
        node.right = {x: node.x + w, y: node.y,     w: node.w - w, h: h         };
        return node;
    }

    growNode(w, h) {
        let canGrowDown  = (w <= this.root.w);
        let canGrowRight = (h <= this.root.h);

        let shouldGrowRight = canGrowRight && (this.root.h >= (this.root.w + w)); // attempt to keep square-ish by growing right when height is much greater than width
        let shouldGrowDown  = canGrowDown  && (this.root.w >= (this.root.h + h)); // attempt to keep square-ish by growing down when width is much greater than height

        if (shouldGrowRight) {
            return this.growRight(w, h);
        } else if (shouldGrowDown) {
            return this.growDown(w, h);
        } else if (canGrowRight) {
            return this.growRight(w, h);
        } else if (canGrowDown) {
            return this.growDown(w, h);
        } else {
            console.warn('Need to ensure sensible root starting size to avoid this happening');
            return null;
        }
    }

    growDown(w, h) {
        this.root = {
            used: true,
            x: 0, y: 0,
            w: this.root.w,
            h: this.root.h + h,
            down:  { x: 0, y: this.root.h, w: this.root.w, h: h },
            right: this.root
        };
        let node = this.findNode(this.root, w, h);
        if (node) {
            return this.splitNode(node, w, h);
        } else {
            return null;
        }
    }

    growRight(w, h) {
        this.root = {
            used: true,
            x: 0, y: 0,
            w: this.root.w + w, h: this.root.h,
            down: this.root,
            right: { x: this.root.w, y: 0, w: w, h: this.root.h }
        };
        let node = this.findNode(this.root, w, h);
        if (node) {
            return this.splitNode(node, w, h);
        } else {
            return null;
        }
    }
}


function exportGLTFs(rules, counts, scaling='linear', name="exported") {
    let pc = [];

    const maxCount = counts[0];
    for (let i=0; i<rules.length; i++) {
        //Assemble rule
        const rule = rules[i];
        console.log(`${i} (${Math.round(100*i/rules.length)}%)`);
        const system = new PolycubeSystem(parseHexRule(rule), new THREE.Scene(), 100, 100, "seeded");
        system.background = true;
        system.seed();
        while (!system.processMoves());

        system.objGroup.name = `${i}_${rule}`;
        system.objGroup.children.forEach(cube=>cube.position.sub(system.centerOfMass));

        if (scaling == 'log') {
            system.objGroup.scale.multiplyScalar(Math.log(counts[i]/Math.log(maxCount)));
        } else {
            system.objGroup.scale.multiplyScalar(counts[i]/maxCount);
        }

        // Find bounding box
        let box = new THREE.Box3().expandByObject(system.objGroup);
        let size = box.getSize(new THREE.Vector3()) //.add(new THREE.Vector3(0.5, 0.5, 0));

        // Rotate so that thinnest dir faces camera
        thinnestIdx = size.toArray().findIndex(v=>v==Math.min(...size.toArray()));
        thinnestDir = new THREE.Vector3().setComponent(thinnestIdx, 1);
        system.objGroup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
            thinnestDir, new THREE.Vector3(0,0,1))
        );

        box = new THREE.Box3().expandByObject(system.objGroup) //.add(new THREE.Vector3(0.5, 0.5, 0));
        size = box.getSize(new THREE.Vector3());
        console.assert(size.z - Math.min(...size.toArray()) < 1e-5,
            `${size.z} !== ${Math.min(...size.toArray())}`
        );

        //system.objGroup.children.forEach(cube=>cube.position.add(size.clone().divideScalar(2)));

        pc.push({
            'w': size.x * 1.25 + 1,
            'h': size.y * 1.25 + 1,
            'obj': system.objGroup
        });
    }

    //let maxSize = Math.max(...pc.map(p=>p.w), ...pc.map(p=>p.h));
    pc.sort((a,b)=>{return b.w*b.h - a.w*a.h});
    let packer = new Packer(pc[0].w, pc[0].h);
    packer.fit(pc);

    // Instantiate an exporter
    let exporter = new THREE.GLTFExporter();
    let options = {'forceIndices': true};

    // Parse the input and generate the glTF output
    exporter.parse(pc.map(p=>p.obj), function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            console.log(output);
            saveString(output, `${name}.gltf`);
        }
    }, options);
}

function exportGLTFsGrid(rules, name="exported", padding = 8) {
    const length = rules.length;
    const a = Math.ceil(Math.sqrt(length));
    const b = Math.ceil(length/a);
    const [xMax, yMax] = [a,b].sort();

    let group = new THREE.Group();

    scene.add(group);

    for (let x=0; x<xMax; x++) {
        for (let y=0; y<yMax; y++) {
            const i = y*xMax + x;
            if (i >= length) {
                break;
            }
            //Assemble rule
            const rule = rules[i];
            console.log(`${i} (${Math.round(100*i/rules.length)}%)`);
            const sys = new PolycubeSystem(parseHexRule(rule), new THREE.Scene(), 100, 100, "seeded");
            sys.background = true;
            sys.seed();
            while (!sys.processMoves());

            sys.objGroup.name = `${i}_${rule}`;
            sys.objGroup.children.forEach(cube=>cube.position.sub(sys.centerOfMass));

            // Find bounding box
            let box = new THREE.Box3().expandByObject(sys.objGroup);
            let size = box.getSize(new THREE.Vector3()) //.add(new THREE.Vector3(0.5, 0.5, 0));

            // Rotate so that thinnest dir faces camera
            thinnestIdx = size.toArray().findIndex(v=>v==Math.min(...size.toArray()));
            thinnestDir = new THREE.Vector3().setComponent(thinnestIdx, 1);
            sys.objGroup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
                thinnestDir, new THREE.Vector3(0,0,1))
            );

            sys.objGroup.position.x = padding*x;
            sys.objGroup.position.y = padding*(yMax-y);

            group.add(sys.objGroup);

            render();
        }
    }

    // Instantiate an exporter
    let exporter = new THREE.GLTFExporter();
    let options = {'forceIndices': true};

    // Parse the input and generate the glTF output
    exporter.parse(group, function (result) {
        if (result instanceof ArrayBuffer) {
            saveArrayBuffer(result, 'scene.glb');
        } else {
            let output = JSON.stringify(result, null, 2);
            saveString(output, `${name}.gltf`);
        }
    }, options);
}

document.addEventListener("keydown", event => {
    if (event.key == 's' && event.ctrlKey) {
        event.preventDefault();
        system.getCoordinateFile();
    } else if (event.key == 'p') {
        saveCanvasImage();
    }
});

function saveCanvasImage(){
    canvas.toBlob(function(blob){
        var a = document.createElement('a');
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${system.getRuleStr()}.png`;
        a.click();
    }, 'image/png', 1.0);
}

rulesToImage = [];
function getImagesFromRules(rules) {
    rulesToImage = rules;
    f = ()=>{
        saveCanvasImage();
        nextrule = rulesToImage.pop();
        if(nextrule){
            system.resetRule(parseHexRule(nextrule));
        }
    };
    window.addEventListener('movesProcessed', f, false);
    nextrule = rulesToImage.pop();
    system.resetRule(parseHexRule(nextrule));
}

function toggleModal(id) {
    let modal = document.getElementById(id);
    modal.classList.toggle("show-modal");
}

// From: https://html-online.com/articles/get-url-parameters-javascript/
function getUrlVars() {
    let vars = {};
    let parts = window.location.href.replace(
        /[?&]+([^=&]+)=([^&]*)/gi, 
        function(m,key,value) {vars[key] = value;}
    );
    return vars;
}

function getUrlParam(param, defaultVal) {
    let vars = getUrlVars();
    return param in vars ? vars[param] : defaultVal;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

// From https://github.com/mrdoob/three.js/pull/14526#issuecomment-497254491
function fitCamera(nSteps) {
    if (camera.type == "OrthographicCamera") {
        return
    }
    nSteps = nSteps || 20;
    const fitOffset = 1.3;
    const box = new THREE.Box3();
    box.expandByObject(system.objGroup);
    const size = box.getSize(new THREE.Vector3()).addScalar(1.5);
    const center = system.centerOfMass; //box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);
    const direction = orbit.target.clone().sub(camera.position).normalize().multiplyScalar(distance);
    orbit.maxDistance = distance * 10;
    camera.near = distance / 100;
    camera.far = distance * 100;
    let targetPos = orbit.target.clone().sub(direction);

    let i = 1;
    let zoomOut = function() {
        camera.position.lerp(targetPos, Math.pow(i/nSteps,2));

        let curr = camera.quaternion.clone();
        camera.lookAt(system.centerOfMass);
        let target = camera.quaternion.clone();
        camera.quaternion.copy(curr);
        camera.quaternion.slerp(target, i/nSteps)

        render();
        if(i < nSteps) {
            i++;
            requestAnimationFrame(zoomOut.bind(this));
        } else {
            orbit.target.copy(center);
        }
    }
    zoomOut();

}

// Regenerate when there are no more cubes to add
window.addEventListener('movesProcessed', function(e) {
    if (!transform || !transform.object) {
        fitCamera();
    }
}, false);

function toggleFog(density=0.08) {
    if (!scene.fog || scene.fog.density != density) {
        scene.fog = new THREE.FogExp2(0xffffff, density);
    } else {
        scene.fog = undefined;
    }
    render();
}

function switchCamera() {
    if (camera instanceof THREE.PerspectiveCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const fov = camera.fov * Math.PI / 180; //convert to radians
        const pos = camera.position;
        let width = 2 * Math.tan(fov / 2) * focus.distanceTo(pos);
        let height = width / camera.aspect;
        const up = camera.up;
        const quat = camera.quaternion;
        let cameraHeading = new THREE.Vector3(0, 0, -1);
        cameraHeading.applyQuaternion(quat);
        //if the camera is upside down, you need to flip the corners of the orthographic box
        /*
        if (quat.dot(refQ) < 0 && quat.w > 0) {
            width *= -1;
            height *= -1;
        }
        */
        //create a new camera with same properties as old one
        const newCam = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, near, far);
        camera.position.clone(pos);
        newCam.up = up;
        newCam.lookAt(focus);
        camera.children.forEach(c => {
            newCam.add(c);
        });
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        scene.add(camera);
    }
    else if (camera instanceof THREE.OrthographicCamera) {
        //get camera parameters
        const far = camera.far;
        const near = camera.near;
        const focus = orbit.target;
        const pos = camera.position;
        const up = camera.up;
        let fov = 2 * Math.atan((((camera.right - camera.left) / 2)) / focus.distanceTo(pos)) * 180 / Math.PI;
        //if the camera is upside down, you need to flip the fov for the perspective camera
        if (camera.left > camera.right) {
            fov *= -1;
        }
        //create a new camera with same properties as old one
        let newCam = createPerspectiveCamera(fov, near, far, pos.toArray());
        newCam.up = up;
        newCam.lookAt(focus);
        let light = pointlight;
        scene.remove(camera);
        camera = newCam;
        orbit.object = camera;
        camera.add(light);
        scene.add(camera);
        document.getElementById("cameraSwitch").innerHTML = "Orthographic";
    }
    render();
}


function render() {
    renderer.render(scene, camera);
}

function initScene() {
    const aspect = window.innerWidth / window.innerHeight;
    cameraPersp = new THREE.PerspectiveCamera(50, aspect, 0.01, 30000);
    cameraOrtho = new THREE.OrthographicCamera(-6 * aspect, 6 * aspect, 6, -6, 0.01, 30000);
    camera = cameraPersp;
    //camera = new THREE.PerspectiveCamera(
    //    45, window.innerWidth / window.innerHeight,
    //    1, 10000);
    camera.position.set(2, 4, 6);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    // lights
    let ambientLight = new THREE.AmbientLight(0x707070);
    camera.add(ambientLight);

    let directionalLight = new THREE.PointLight(0x707070);
    directionalLight.position.set(10, 10, 5).normalize();
    camera.add(directionalLight);

    scene.add(camera);

    canvas = document.getElementById("threeCanvas");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvas,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    window.addEventListener('resize', onWindowResize, false);

    // orbit controls

    orbit = new THREE.OrbitControls(camera, canvas);
    orbit.damping = 0.2;
    orbit.addEventListener('change', render);
}

let cameraPersp, cameraOrtho, camera;
let orbit, scene, renderer, canvas, transform;
let plane;
let mouse, raycaster;
let rollOverMesh, rollOverMaterial;

//let objects = [];

initScene();


