import sys
import os
import utils
import pandas as pd
import h5py

def analyse(path, toFile=True):
    print("Analysing '{}'".format(path))
    data = []
    f = h5py.File(path, 'r')
    for n, shapegroup in f.items():
        for shape, ps in shapegroup.items():
            sizeId = n + '/' + shape;
            size = int(n.strip("-mer"))
            for i, genotypes in enumerate(ps.values()):
                count = len(genotypes)
                minNc, minNc_r, minNt, minNt_r, minLz, minLz_r = utils.getMinComplexity(genotypes)
                pheno = {
                    'count': count,
                    'minNc': minNc, 'minNc_r': minNc_r, # Min number of colors
                    'minNt': minNt, 'minNt_r': minNt_r, # Min number of cube types
                    'minLz': minLz, 'minLz_r': minLz_r, # Min Lempel-Ziv size
                    'size': size,
                    'sizeId': sizeId
                }
                data.append(pheno)
                print('.', end='', flush=True)
            print("Handled phenotypes of shape {}.".format(sizeId))
    df = pd.DataFrame(data)
    df.attrs['instrument_name'] = 'Binky'
    if toFile:
        outpath = os.path.splitext(path)[0]+'_analysed.ftr'
        df.to_feather(outpath)
        print("Saved result as '{}'".format(outpath))
    return df

def readAnalysed(path):
    return pd.read_feather(path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyse(sys.argv[1], True)
    else:
        print("Please provide a path to an output hdf5 file")
