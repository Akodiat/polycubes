function generateInputFile(
    nParticleTypes, nPatchTypes,
    oxDNA_dir,
    patchesFileName = 'patches.txt',
    particlesFileName = 'particles.txt',
    topFileName = 'init.top',
    temperature="[template]",
    narrow_type="0"
) {
    return `
##############################
####  PROGRAM PARAMETERS  ####
##############################
backend = CPU
backend_precision = double
#debug = 1
#seed = 10
ensemble = NVT
delta_translation = 0.1
delta_rotation = 0.1
narrow_type = ${narrow_type}
##############################
####    SIM PARAMETERS    ####
##############################
newtonian_steps = 103
diff_coeff = 0.1
thermostat = john
sim_type = MD
dt = 0.001
verlet_skin = 0.05
no_stdout_energy = 0
restart_step_counter = 1
energy_file = energy.dat
print_conf_interval = 1e7
print_energy_every = 1e5
time_scale = linear
PATCHY_alpha = 0.12
no_multipatch = 1
steps = 5e9
check_energy_every = 10000
check_energy_threshold = 1.e-4
T = ${temperature}
refresh_vel = 1
############################
######## PATCHY SETUP ######
############################
#interaction_type = PLPATCHY_KF_like
#interaction_type = PLPATCHY
interaction_type = PatchyShapeInteraction

plugin_search_path = ${oxDNA_dir}/contrib/romano
shape = sphere

particle_types_N = ${nParticleTypes}
patch_types_N  = ${nPatchTypes}

patchy_file = ${patchesFileName}
particle_file = ${particlesFileName}
same_type_bonding = 1
use_torsion = 1
interaction_tensor = 0

#interaction_tensor_file = REFIX.int.tensor.txt

#Set the radius of the sphere
PATCHY_radius = 0.5

lastconf_file = last_conf.dat
##############################
####    INPUT / OUTPUT    ####
##############################

topology = ${topFileName}
conf_file = init.conf
trajectory_file = trajectory.dat

#Print out clusters 
data_output_1 = {
  name = clusters.txt
  print_every = 1e7
  col_1 = {
    type = PLClusterTopology
    show_types = 1
  }
}
`
}

function generateTopAndConfig(rule, assemblyMode='seeded') {
    let sys = new PolycubeSystem(rule, undefined, 100, 100, assemblyMode, true);
    sys.seed();
    let processed = false;
    while (!processed) {
        processed = sys.processMoves();
        if (processed == 'oub') {
            console.warn("Getting config for unbounded rule");
            break;
        }
    }
    let top = [];
    let conf = [];
    let nParticles = 0;
    let max = new THREE.Vector3();
    let min = new THREE.Vector3();
    let mean = new THREE.Vector3();
    for (const [key, c] of system.confMap) {
        const p = system.cubeMap.get(key);
        for (let i=0; i<3; i++) {
            max.setComponent(i, Math.max(max.getComponent(i), p.getComponent(i)));
            min.setComponent(i, Math.min(min.getComponent(i), p.getComponent(i)));
        }
        mean.add(p);
        nParticles++;
    }
    let box = max.clone().sub(min).multiplyScalar(3);
    mean.divideScalar(nParticles);

    for (const [key, c] of system.confMap) {
        const p = system.cubeMap.get(key).sub(mean).add(box.clone().divideScalar(2));
        const a1 = new THREE.Vector3(1, 0, 0).applyQuaternion(c.q);
        const a3 = new THREE.Vector3(0, 0, 1).applyQuaternion(c.q);
        const vF = (v) => v.toArray().map(
            n=>Math.round(n*100)/100 // Round to 2 decimal places
        ).join(' ');
        conf.push(`${vF(p)} ${vF(a1)} ${vF(a3)} 0 0 0 0 0 0`);
        top.push(`${c.ruleIdx}`);
    }
    let confStr = `t = 0\nb = ${box.toArray().join(' ')}\nE = 0 0 0\n` + conf.join('\n');
    let topStr = `${nParticles} ${rule.length}\n` + top.join(' ');
    return [topStr, confStr];
}

function getPatchySimFiles(rule, nAssemblies=1, name='sim',
    oxDNA_dir = '/users/joakim/repo/oxDNA_torsion',
    temperatures = ['0.01'],
    confDensity = 0.2,
    narrow_types=['0'],
    multifarious = false
) {
    let zip = new JSZip();
    let getPatchStr = (id, color, i, a2, strength=1)=>{
        let a1 = ruleOrder[i].clone();
        return [
            `patch_${id} = {`,
            `  id = ${id}`,
            `  color = ${color}`,
            `  strength = ${strength}`,
            `  position = ${a1.clone().divideScalar(2).toArray()}`,
            `  a1 = ${a1.toArray()}`,
            `  a2 = ${a2.toArray()}`,
            '}',''
        ].join('\n')
    }
    let getParticleStr = (typeID, patches)=>[
        `particle_${typeID} = {`,
        `  type = ${typeID}`,
        `  patches = ${patches}`,
        '}',''
    ].join('\n');

    let particlesStr = "";
    let patchesStr = "";

    let patchCounter = 0;
    rule.forEach((cubeType, typeID)=>{
        let patches = [];
        cubeType.forEach((patch, i)=>{
            if(patch.color != 0) {
                // Needs to be > 20 to not be self complementary
                let color = patch.color + 20 * Math.sign(patch.color);
                patchesStr += getPatchStr(patchCounter, color, i, patch.alignDir);
                patches.push(patchCounter);
                patchCounter++;
            }
        });
        particlesStr += getParticleStr(typeID, patches);
    });

    const particlesFileName = 'particles.txt'
    const patchesFileName = 'patches.txt'

    const cubeTypeCount = multifarious ? getCubeTypeCount(rule, 'stochastic', 1000) : getCubeTypeCount(rule);

    let topStr, confStr;
    const topFileName = 'init.top';
    const confFileName = 'init.conf';
    if (nAssemblies > 1) {
        const count = cubeTypeCount.map(n=>n*nAssemblies);

        let total = 0;
        let top = [];
        count.forEach((c, typeID)=>{
            total+=c;
            for(let i=0; i<c; i++) {
                top.push(typeID);
            }
        });
        topStr = `${total} ${rule.length}\n${top.join(' ')}`;
    } else {
        [topStr, confStr] = generateTopAndConfig(rule, assemblyMode);
    }

    const inputFileName = 'input';
    let confGenStr = `${oxDNA_dir}/build/bin/confGenerator ${inputFileName} ${confDensity}`;

    for (const narrow_type of narrow_types) {
        let ntfolder = zip.folder(`nt${narrow_type}`);
        for (const temperature of temperatures) {
            let folder = ntfolder.folder(`T_${temperature}`);

            let inputStr = generateInputFile(rule.length, patchCounter, oxDNA_dir, patchesFileName,
                particlesFileName, topFileName, temperature, narrow_type
            );

            let simulateStr = `addqueue -c "${name} T=${temperature} nt${narrow_type} - 1 week" ${oxDNA_dir}/build/bin/oxDNA ${inputFileName}`;

            let submit_slurmStr = `#!/bin/bash
#SBATCH -p sulccpu1
#SBATCH -q wildfire
#SBATCH -n 1                    # number of cores
#SBATCH -t 8-00:00              # wall time (D-HH:MM)
#SBATCH --job-name="${name}_T${temperature}_nt${narrow_type}"

module add gcc/8.4.0                                        # and the required C compiler \ lib

${oxDNA_dir}/build/bin/oxDNA ${inputFileName}`

            folder.file(particlesFileName, particlesStr);
            folder.file(patchesFileName, patchesStr);
            folder.file(topFileName, topStr);
            folder.file(inputFileName, inputStr);
            folder.file('generateConf.sh', confGenStr);
            folder.file('simulate.sh', simulateStr);
            folder.file('submit_slurm.sh', submit_slurmStr);

            if (confStr) {
                folder.file(confFileName, confStr);
            }
        }
    }

    zip.file(
        'simulateAll.sh', `
for var in */nt*/T_*
do
    cd $var
    bash generateConf.sh
    bash simulate.sh
    cd ../../..
done`
    );

    let complClusters = cubeTypeCount.flatMap((n,idx) => {
        let cluster = [];
        for (let i=0; i<n; i++) {
            cluster.push(idx)
        }
        return cluster;
    });

    zip.file('data.py',
`completeCluster = [${complClusters}]
rule = '${ruleToDec(rule)}'`
    )

    zip.generateAsync({type:"blob"})
    .then(function(content) {
        saveAs(content, `${name}.zip`); //FileSaver.js
    });
}