import phenotypes_pb2
import sys
import polycubes
import os

def checkSettings(a, b):
    msg = 'Incompatible datasets'
    assert len(set(d.nColors for d in [a, b])) == 1, msg
    assert len(set(d.nCubeTypes for d in [a, b])) == 1, msg
    assert len(set(d.nDimensions for d in [a, b])) == 1, msg
    assert len(set(d.assemblyMode for d in [a, b])) == 1, msg

def readDatasets(paths):
    dataset = phenotypes_pb2.Dataset()
    for i, path in enumerate(paths):
        tmp = phenotypes_pb2.Dataset()
        with open(path, "rb") as f:
            tmp.ParseFromString(f.read())
        if i>0:
            checkSettings(dataset, tmp)
        dataset.MergeFrom(tmp)
    return dataset

def merge(outdir):
    files = []
    for r, _, fs in os.walk(outdir):
        files = [f for f in fs if ".bin" in f]
        root = r
        break
    print("Merging files: {}".format(files))
    dataset = readDatasets(os.path.join(root, f) for f in files)

    phenos = {}
    for key, pheno in dataset.phenotypes.items():
        sizeId, idx, pid = key.rsplit('_', maxsplit=2)
        if not sizeId in phenos:
            phenos[sizeId] = []
        phenos[sizeId].append({'key': key, 'pid': pid, 'rule': pheno.rules[0]})
    phenos

    mergedDataset = phenotypes_pb2.Dataset()
    for sizeId, phenolist in phenos.items():
        groups = []
        for p in phenolist:
            foundGroup = False
            for group in groups:
                if (p['pid'] not in group['pids'] and 
                    polycubes.checkEquality(p['rule'], group['rule'], dataset.assemblyMode)
                ):
                    foundGroup = True
                    group['keys'].append(p['key'])
                    group['pids'].append(p['pid'])
                    break
            if not foundGroup:
                groups.append({
                    'keys': [p['key']],
                    'pids': [p['pid']],
                    'rule': p['rule']
                })

        for i, group in enumerate(groups):
            sample = dataset.phenotypes[group['keys'][0]]
            key = "{}_{}_{}".format(sample.size, i, os.getpid())
            p = mergedDataset.phenotypes[key]
            p.size = sample.size
            p.dim1 = sample.dim1
            p.dim2 = sample.dim2
            p.dim3 = sample.dim3
            for key in group['keys']:
                p.rules.extend(dataset.phenotypes[key].rules)

    for f in files:
        os.renames(os.path.join(root, f), os.path.join(root, 'merged', f))
    
    outpath = os.path.join(root, 'phenos_{}.bin'.format(os.getpid()))
    with open(outpath, "wb") as f:
        f.write(dataset.SerializeToString())
    print("Saved merged dataset as {}".format(outpath))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        merge(sys.argv[1])
    else:
        print("Please provide a path to an out directory")
        merge('cpp/out')