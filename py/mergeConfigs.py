import sys
import os
from utils import readConf

def writeConf(filename, conf):
    with open(filename, "w") as f:
        for key, val in conf.items():
            f.write("{} = {}\n".format(key, val))

def mergeConfigs(outdir, pid):
    mergedResult = {}
    mergedConf = {}
    for root, _, conffiles in os.walk(outdir):
        confs = [readConf(os.path.join(root, c)) for c in conffiles if ".conf" in c]
        results = [readConf(os.path.join(root, c)) for c in conffiles if ".result" in c]
        for key in ['nColors', 'nCubeTypes', 'nDimensions', 'nTries', 'assemblyMode']:
            mergedConf[key] = confs[0][key]
            for c in confs:
                if c[key] != mergedConf[key]:
                    raise ValueError("Different {} values in config: {} vs {}".format(key, c[key], mergedConf[key]))
        mergedConf['pid'] = pid
        mergedConf['nRules'] = sum(int(r['nRules']) for r in confs)
        for key in ['nPhenos', 'nOub', 'nNondet', 'nTot']:
            try:
                mergedResult[key] = sum(int(r[key]) for r in results)
            except:
                print("Warning, no value for {} found in result (did the sampling exit correctly?). Frequency data will be invalid".format(key))
                mergedResult[key] = -1
        for c in conffiles:
            if ".conf" in c or ".result" in c:
                os.renames(os.path.join(root, c), os.path.join(root, 'merged', c))
        break

    writeConf(os.path.join(outdir, "{}.conf".format(pid)), mergedConf)
    writeConf(os.path.join(outdir, "{}.result".format(pid)), mergedResult)

if __name__ == "__main__":
    if len(sys.argv) > 2:
        mergeConfigs(sys.argv[1], sys.argv[2])
    else:
        print("Please provide a path to an out directory and an id")