function generateInputFile(
    nParticleTypes, nPatchTypes,
    oxDNA_dir,
    patchesFileName = 'patches.txt',
    particlesFileName = 'particles.txt',
    topFileName = 'init.top',
    temperature="[template]"
) {
    return `
##############################
####  PROGRAM PARAMETERS  ####
##############################
backend = CPU
backend_precision = double
#debug = 1
seed = 10
ensemble = NVT
delta_translation = 0.1
delta_rotation = 0.1
narrow_type = 0
##############################
####    SIM PARAMETERS    ####
##############################
newtonian_steps = 103
diff_coeff = 0.1
thermostat = john
sim_type = MD
dt = 0.001
verlet_skin = 0.05
#sim_type = MC2
move_1 = {
  type = MCMovePatchyShape
  delta = 0.1
  prob = 1
  delta_translation = 0.1
  delta_rotation = 0.1
}
no_stdout_energy = 0
restart_step_counter = 1
energy_file = energy.dat
print_conf_interval = 1e7
print_energy_every = 1e5
time_scale = linear
PATCHY_alpha = 0.12
no_multipatch = 1
steps = 5e10
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
 print_every = 2e6
 col_1 = {
   type = PLCluster
   show_types = 1
 }
}`
}

function getPatchySimFiles(hexRule, nAssemblies=1, name='sim',
    oxDNA_dir = '/users/joakim/repo/oxDNA_torsion2',
    temperatures = ['[template]'],
    confDensity = 0.2
) {
    let zip = new JSZip();
    for (const temperature of temperatures) {
        let folder = zip.folder(`T_${temperature}`);

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
        let rule = parseHexRule(hexRule);
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

        const cubeTypeCount = getCubeTypeCount(hexRule);
        const count = cubeTypeCount.map(n=>n*nAssemblies);

        let total = 0;
        let top = [];
        count.forEach((c, typeID)=>{
            total+=c;
            for(let i=0; i<c; i++) {
                top.push(typeID);
            }
        });
        let topStr = `${total} ${rule.length}\n${top.join(' ')}`;

        const topFileName = 'init.top';

        let inputStr = generateInputFile(rule.length, patchCounter, oxDNA_dir, patchesFileName,
            particlesFileName, topFileName, temperature
        );

        const inputFileName = 'input';

        let confGenStr = `${oxDNA_dir}/build/bin/confGenerator ${inputFileName} ${confDensity}`;
        let simulateStr = `addqueue -c "${name} T=${temperature} - 1 week" ${oxDNA_dir}/build/bin/oxDNA ${inputFileName}`;

        folder.file(particlesFileName, particlesStr);
        folder.file(patchesFileName, patchesStr);
        folder.file(topFileName, topStr);
        folder.file(inputFileName, inputStr);
        folder.file('generateConf.sh', confGenStr);
        folder.file('simulate.sh', simulateStr);
    }

    zip.file(
        'simulateAll.sh', `
for var in T_*
do
    cd $var
    bash generateConf.sh
    bash simulate.sh
    cd ..
done`
    );

    zip.generateAsync({type:"blob"})
    .then(function(content) {
        saveAs(content, `${name}.zip`); //FileSaver.js
    });
}