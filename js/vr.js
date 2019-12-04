var rotation = 0;
var rig = new THREE.PerspectiveCamera();
rig.add(camera);
scene.add(rig);

document.body.appendChild(VRButton.createButton(renderer));
renderer.vr.enabled = true;
renderer.setAnimationLoop(function(){
    rotation += 0.001;
    rig.position.z = Math.sin(rotation) * 5;
    rig.position.x = Math.cos(rotation) * 5;
    rig.lookAt(polycubeSystem.centerOfMass);
    //orbit.update();
    renderer.render(scene, camera);
});


