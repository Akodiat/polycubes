import sys
import libpolycubes
import os
import h5py

def parseRule(rule):
    try:
        return rule if isinstance(rule, str) else rule.decode()
    except:
        print("Could not parse {}".format(rule))
        return rule

def getRules(path, n, shape, index):
    f = h5py.File(path, 'r')
    #[parseRule(v) for v in f['26-mer']['7.4.1']['pheno_0']]
    return (parseRule(v) for v in f[n][shape]["pheno_{}".format(index)])

def merge(outdir, assemblyMode):
    # Find all HDF5 files in directory
    files = []
    for r, _, fs in os.walk(outdir):
        files = [f for f in fs if ".h5" in f]
        root = r
        break

    # Index all phenotypes by their size
    phenos = {}
    for iFile, filename in enumerate(files):
        with h5py.File(os.path.join(root, filename), 'r') as f:
            for n, shapegroup in f.items():
                for shape, ps in shapegroup.items():
                    sizeId = n + '/' + shape;
                    if not sizeId in phenos:
                        phenos[sizeId] = []
                    for i, pheno in enumerate(ps.values()):
                        # Add extra check to make sure the representative rules we use are deterministic
                        idx = 0
                        while idx < len(pheno) and not libpolycubes.isBoundedAndDeterministic(parseRule(pheno[idx]), 100, assemblyMode):
                            print("{}: {} at {} in {} is not reliable".format(idx, parseRule(pheno[idx]), sizeId, filename))
                            idx += 1
                        if idx >= len(pheno):
                            continue
                        phenos[sizeId].append({
                            'filename': filename,
                            'rule': parseRule(pheno[idx]),
                            'idx': i
                        })
        print("Read file {} ({} files remaining)".format(filename, len(files) - iFile - 1))

    print("Sorted phenotypes by size")

    # Move the old files to a "merged" directory
    for f in files:
        os.renames(os.path.join(root, f), os.path.join(root, 'merged', f))

    print("Moved old files to {}".format(os.path.join(root, 'merged')))

    outpath = os.path.join(root, 'out_{}.h5'.format(os.getpid()))
    with h5py.File(outpath, "w") as f:
        # For all phenotypes with the same dimensions
        for sizeId, phenolist in phenos.items():
            print("Grouping {}:".format(sizeId), end=' ', flush=True)
            n, shape = sizeId.split('/')
            groups = []
            for p in phenolist:
                foundGroup = False
                for group in groups:
                    # Check if rules from different files represent the same phenotype
                    if (p['filename'] not in group['filenames'] and 
                        libpolycubes.checkEquality(p['rule'], group['rule'], assemblyMode)
                    ):
                        foundGroup = True
                        group['filenames'].append(p['filename'])
                        group['indices'].append(p['idx'])
                        break
                if not foundGroup:
                    groups.append({
                        'filenames': [p['filename']],
                        'rule': p['rule'],
                        'indices':[p['idx']]
                    })
                    print('.', end='', flush=True)

            h5group = f.create_group(sizeId)

            # For all phenotype groups found
            for i, group in enumerate(groups):
                rules = [r
                    for j, filename in enumerate(group['filenames']) 
                    for r in getRules(os.path.join(root, 'merged', filename), n, shape, group['indices'][j])
                ]

                #print("Adding {} rules to pheno {} in {}".format(len(rules), i, sizeId))

                dataset = h5group.create_dataset('pheno_{}'.format(i), (len(rules),), h5py.string_dtype())
                for i, r in enumerate(rules):
                    dataset[i] = r.encode()

            print(" (Found {} unique phenotypes)".format(len(groups)), flush=True)

    print("Saved merged dataset as {}".format(outpath))

if __name__ == "__main__":
    if len(sys.argv) > 2:
        merge(sys.argv[1], sys.argv[2])
    else:
        print("Please provide a path to an out directory and an assembly mode")
