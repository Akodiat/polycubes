import re
import sys
import networkx as nx
from networkx.algorithms import isomorphism
import json
import pickle
from pathlib import Path

def graphShape(shapePath):
    with open(shapePath, 'r') as f:
        data = f.read()
    solveSpec = json.loads(data)
    G = nx.Graph()
    for i, _, j, _ in solveSpec['bindings']:
        G.add_edge(i, j)
    return G

def graphsFromClusters(line):
    clusterGraphs = []
    clusters = re.finditer('\[.+?\]', line)

    for cluster in clusters:
        G = nx.Graph()
        matches = re.finditer(
            '(\d+) -> \(((?:\d+ ?)+)\)', cluster.group()
        )
        for m in matches:
            source = m.group(1)
            for dest in m.group(2).split(' '):
                G.add_edge(int(source), int(dest))
        clusterGraphs.append(G)
    return clusterGraphs

def getGraphOverlap(g1, g2, cutoff=1):
    sizeFrac = len(g2)/len(g1)
    return sizeFrac if sizeFrac <= 1 and sizeFrac >= cutoff and isomorphism.GraphMatcher(
        nx.line_graph(g1), nx.line_graph(g2)
    ).subgraph_is_isomorphic() else 0

def getClusterYield(line, refGraph, cutoff):
    return sum(getGraphOverlap(refGraph, g, cutoff) for g in graphsFromClusters(line))

def readClusters(clustersPath, shapePath, cutoff, nSamples=float("inf")):
    refGraph = graphShape(shapePath)
    with open(clustersPath) as f:
        lines = [line for line in f]
        nLines = len(lines)
        nSamples = min(nSamples, nLines)
        sampleEvery = round(nLines/nSamples)
        clusters = [getClusterYield(line, refGraph, cutoff) for i, line in enumerate(lines) if i%sampleEvery == 0]
    return clusters

def readEnergy(filename):
    energies = {}
    with open(filename) as f:
        step = 0
        for line in f: 
            time, potential_energy, _,_ = line.split()
            energies[float(time)] = float(potential_energy)
    return energies

def nameConv(name):
    if name == 'J':
        return 'letter_J'
    if name == 'box':
        return 'cube'
    if name == 'solid':
        return 'filled_cube'
    return name

def analyse(clusterPath, shapeDir, cutoff, nSamplePoints, clusterPrintEvery = 2e6):
    clusterPath = str(Path(clusterPath).absolute())
    if 'duplicate' in clusterPath:
        shape, duplStr, potential, tempStr, clusterFile = clusterPath.split('/')[-5:]
        duplicate = float(duplStr.strip('duplicate_'))
    else:
        shape, potential, tempStr, clusterFile = clusterPath.split('/')[-4:]
        duplicate = 0

    temp = float(tempStr.strip('T_'))
    
    t = shape.rsplit('_', 1)
    
    if t[-1] == 'full' or t[-1] == 'inter':
        shapeType = t[-1]
        shape = t[0]
    else:
        shapeType = 'minimal'

    clusters = readClusters(
        clusterPath,
        shapeDir+'/{}.json'.format(shape),
        cutoff,
        nSamplePoints
    )
    
    data = []
    maxYield = 0
    for t, clusterYield in enumerate(clusters):
        maxYield = max(maxYield, clusterYield)
        data.append({
            'shape': shape,
            'type': shapeType,
            'temp': temp,
            'potential': potential,
            'duplicate': duplicate,
            'yield': clusterYield,
            'timestep': t * clusterPrintEvery
        })
    print("{} {} {} T={} - Max yield: {}".format(shape, potential, shapeType, temp, maxYield))

    with open(Path(clusterPath).parent.absolute() / "clusters.pickle", 'wb') as f:
        pickle.dump(data, f)

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Incorrect number of arguments (need 4 not {}):".format(len(sys.argv)-1))
        print(sys.argv[0]+ " clusterPath shapeDir cutoff nSamplePoints")
    else:
        analyse(sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), clusterPrintEvery = 2e6)
"""
    clusterPrintEvery = 2e6

    if len(sys.argv) != 5:
        print("Incorrect number of arguments (need 4 not {}):".format(len(sys.argv)-1))
        print(sys.argv[0]+ " clusterPath shapeDir cutoff nSamplePoints")
    else:
        dirPath = Path(sys.argv[1]).parent.absolute()
        directory = dirPath.parent.parent.name
        
        t = directory.split('_')
        if 'letter_J' in directory:
            t = str(directory).replace('letter_J', 'J').split('_')
        shape = nameConv(t[0])
        shapeType = t[-1] if len(t) > 1 else 'minimal'
        
        temp = float(dirPath.name.strip('T_'))
        
        clusters = readClusters(
            sys.argv[1],
            sys.argv[2]+'/{}.json'.format(shape),
            float(sys.argv[3]),
            int(sys.argv[4])
        )

        data = []
        maxYield = 0
        for t, clusterYield in enumerate(clusters):
            maxYield = max(maxYield, clusterYield)
            data.append({
                'dir': directory,
                'shape': shape,
                'type': shapeType,
                'temp': temp,
                'yield': clusterYield,
                'timestep': t * clusterPrintEvery
            })
        print("{} {} T={} - Max yield: {}".format(shape, shapeType, temp, maxYield))
        
        with open(dirPath / "clusters.pickle", 'wb') as f:
            pickle.dump(data, f)
"""
    