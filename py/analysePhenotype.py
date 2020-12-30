import re
import utils
import os
import pickle
import sys

def analysePhenotype(path):
    print("Analysing phenotype:"+path)
    filename = os.path.split(path)[-1]
    r = re.search(r'pheno_((\d+)_\d+,\d+,\d+)_\d+_(\d+)', filename)
    if r: # If filename matches
        sizeId = r.group(1)
        n = r.group(2)
        pID = r.group(3)
        genotypes = utils.getRulesFromPheno(path)
        count = len(genotypes)
        minNc, minNc_r, minNt, minNt_r, minLz, minLz_r = utils.getMinComplexity(genotypes)
        try:
            nTot = int(utils.readConf(os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(path))),
                pID+'.result')
            )['nTot'])
        except:
            print("Warning, no nTot count found in {}.result. Frequency data will be invalid".format(pID))
            nTot = -1
        pheno = {
            'count': count,
            'freq': count/nTot,
            'minNc': minNc, 'minNc_r': minNc_r, # Min number of colors
            'minNt': minNt, 'minNt_r': minNt_r, # Min number of cube types
            'minLz': minLz, 'minLz_r': minLz_r, # Min Lempel-Ziv size
            'size': n,
            'sizeId': sizeId,
            'genotypes': genotypes
        }
        print("Dumping to "+path+'.p')
        pickle.dump(pheno, open(path+'.p', "wb"))
    else:
        print("Invalid filename: "+pheno)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analysePhenotype(sys.argv[1])
    else:
        print("Please provide a path to a phenotype output textfile")