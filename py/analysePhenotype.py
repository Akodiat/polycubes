import sys
import os
import utils
import pandas as pd
import h5py

def analyse(path, toFile=True, assemblyMode='seeded', ndim=3):
    print("Analysing '{}'".format(path))

    rotations = utils.getRotations(ndim)
    reflections = utils.getReflections(ndim)

    data = []
    f = h5py.File(path, 'r')
    for n, shapegroup in f.items():
        for shape, ps in shapegroup.items():
            sizeId = n + '/' + shape;
            size = int(n.strip("-mer"))
            for i, genotypes in enumerate(ps.values()):
                count = len(genotypes)
                minNc, minNc_r, minNt, minNt_r, minLz, minLz_r = utils.getMinComplexity(genotypes)
                rotsymms, reflsymms, invsymms = utils.getSymms(minNt_r, assemblyMode, ndim, rotations, reflections)
                pheno = {
                    'count': count,
                    'minNc': minNc, 'minNc_r': minNc_r, # Min number of colors
                    'minNt': minNt, 'minNt_r': minNt_r, # Min number of cube types
                    'minLz': minLz, 'minLz_r': minLz_r, # Min Lempel-Ziv size
                    'size': size,
                    'sizeId': sizeId,
                    'rotsymms': rotsymms,
                    'reflsymms': reflsymms,
                    'invsymms': invsymms
                }
                data.append(pheno)
                print('.', end='', flush=True)
            print("Handled phenotypes of shape {}.".format(sizeId))
    df = pd.DataFrame(data)
    if toFile:
        outpath = os.path.splitext(path)[0]+'_analysed.ftr'
        df.to_feather(outpath)
        print("Saved result as '{}'".format(outpath))
    return df

def readAnalysed(path):
    return pd.read_feather(path)

if __name__ == "__main__":
    if len(sys.argv) > 3:
        analyse(sys.argv[1], toFile=True, assemblyMode=sys.argv[2], ndim=int(sys.argv[3]))
    else:
        print("Please provide a path to an output hdf5 file")
