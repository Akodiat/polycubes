class OxViewSystem {
    constructor() {
        this.strands = [];
        this.monomerIdCounter = 0;
        this.strandIdCounter = 0;
        this.clusterCounter = 1;
        this.box = 0;
        this.idMaps = new Map();
    }

    toJSON() {
        return {
            date: new Date(),
            box: [this.box, this.box, this.box],
            systems: [{
                id: 0,
                strands: this.strands
            }],
        }
    }

    saveToFile(filename) {
        saveString(
            JSON.stringify(this,
                undefined, 2  // Indent
                ).replace(    // But not too much
                    /(".+": \[)([^\]]+)/g, (_, a, b) => a + b.replace(/\s+/g, ' ')
            ), filename
        );
    }

    addFromJSON(data, position, orientation, uuid, color, randSeq = false) {
        const cluster = this.clusterCounter++;
        const idMap = new Map();
        let newStrands = [];
        data.systems.forEach(sys => {
            sys.strands.forEach(strand=>{
                let newStrand = Object.assign({}, strand);
                newStrand.id = this.strandIdCounter++;
                newStrand.monomers = [];
                strand.monomers.forEach(monomer=>{

                    // Position and orientate correctly

                    let p = new THREE.Vector3().fromArray(monomer.p);
                    let a1 = new THREE.Vector3().fromArray(monomer.a1);
                    let a3 = new THREE.Vector3().fromArray(monomer.a3);

                    p.applyQuaternion(orientation);
                    a1.applyQuaternion(orientation);
                    a3.applyQuaternion(orientation);

                    p.add(position);

                    monomer.p = p.toArray();
                    monomer.a1 = a1.toArray();
                    monomer.a3 = a3.toArray();
                    monomer.cluster = cluster;

                    if (color !== undefined) {
                        monomer.color = color.getHex();
                    }

                    // Update monomer IDs
                    let newId = this.monomerIdCounter++;
                    idMap.set(monomer.id, newId);
                    monomer.id = newId;

                    // Resize box
                    this.box = Math.max(this.box,
                        Math.abs(3*p.x),
                        Math.abs(3*p.y),
                        Math.abs(3*p.z)
                    );

                    newStrand.monomers.push(monomer);
                });
                newStrand.monomers.forEach(monomer=>{
                    if (monomer.n3 !== undefined) {
                        monomer.n3 = idMap.get(monomer.n3);
                    }
                    if (monomer.n5 !== undefined) {
                        monomer.n5 = idMap.get(monomer.n5);
                    }
                })
                if(newStrand.end3 >= 0) {
                    newStrand.end3 = idMap.get(newStrand.end3);
                }
                if(newStrand.end5 >= 0) {
                    newStrand.end5 = idMap.get(newStrand.end5);
                }
                newStrands.push(newStrand);
            });
        });

        const randomChoice = (l)=>{
            var index = Math.floor(Math.random() * l.length);
            return l[index];
        }

        newStrands.forEach(strand=>{
            strand.monomers.forEach(monomer=>{
                if (monomer.bp !== undefined) {
                    monomer.bp = idMap.get(monomer.bp);
                }
            });
            this.strands.push(strand);
        });

        // Save id map to use in ligation
        this.idMaps.set(uuid, idMap);


        if (randSeq) {
            newStrands.forEach(s=>{s.monomers.forEach(monomer=>{
                let [rndType, rndBpType] = randomChoice([
                    ['A', 'T'], ['T', 'A'],
                    ['G', 'C'], ['C', 'G']
                ]);
                monomer.type = rndType;
                if (monomer.bp !== undefined) {
                    this.findById(monomer.bp)[1].type = rndBpType;
                }
            })});
        }
    }

    findById(id) {
        for (const s of this.strands) {
            for (const e of s.monomers) {
                if (e.id == id) {
                    return [s, e];
                }
            }
        }
    }

    connectBuildingBlocks(b1, b1PatchId, b2, b2PatchId) {
        // Find monomer ID's for patch pasepairs
        let [n5b1, n3b1] = b1.buildingBlock.patchNucleotides[b1PatchId];
        let [n5b2, n3b2] = b2.buildingBlock.patchNucleotides[b2PatchId];

        // Check if ends should be ligated (i.e. not an endpoint)
        if (n5b1 !== undefined && n3b2 !== undefined) {
            // Change to actual updated IDs
            n5b1 = this.idMaps.get(b1.uuid).get(n5b1);
            n3b2 = this.idMaps.get(b2.uuid).get(n3b2);
            // Ligate
            this.ligate(n5b1, n3b2);
        }
        // Do the same for second patch
        if (n5b2 !== undefined && n3b1 !== undefined) {
            n5b2 = this.idMaps.get(b2.uuid).get(n5b2);
            n3b1 = this.idMaps.get(b1.uuid).get(n3b1);
            this.ligate(n5b2, n3b1);
        }
    }

    getNucPos(nucId, cubeId) {
        let [_, e] = this.findById(this.idMaps.get(cubeId).get(nucId));
        return new THREE.Vector3().fromArray(e.p);
    }

    getNuc(nucId, key) {
        let [_, e] = this.findById(this.idMaps.get(key).get(nucId));
        return e;
    }

    ligate(idA, idB) {
        let [strandA, a] = this.findById(idA);
        let [strandB, b] = this.findById(idB);

        // Find out which is the 5' end and which is 3'
        let end5, end3, strand5, strand3;
        if (!a.n5 && !b.n3) {
            end5 = a; strand5 = strandA;
            end3 = b; strand3 = strandB;
        }
        else if (!a.n3 && !b.n5) {
            end5 = b; strand5 = strandB;
            end3 = a; strand3 = strandA;
        } else {
            console.error("Select one nucleotide with an available 3' connection and one with an available 5'"+
            `\n${end5.id}.n5 == ${end5.n5}, ${end3.id}.n3 == ${end3.n3}`)
            return;
        }

        // strand3 will be merged into strand5

        //connect the 2 element objects
        end5.n5 = end3.id;
        end3.n3 = end5.id;
        // Update 5' end to include the new elements
        strand5.end5 = strand3.end5;

        //check that it is not the same strand
        if (strand5 !== strand3) {
            // Move all monomers from strand 3 to strand 5
            for(const e of strand3.monomers) {
                strand5.monomers.push(e);
            }
            // Remove strand3
            this.strands = this.strands.filter(s => s !== strand3);
        }
    }

    nick(id) {
        let [strand, e] = this.findById(id);
        const idx = strand.monomers.indexOf(e);
        if (e.n3 === undefined) {
            console.warn('Nucleotide already nicked');
            return;
        }

        // Assuming the monomers are in 5' to 3' order
        let newStrand = {
            'id': this.strandIdCounter++,
            'monomers': strand.monomers.slice(idx+1),
            'end5': e.n3,
            'end3': strand.end3,
            'class': strand.class
        };
        strand.end3 = e.id;
        strand.monomers = strand.monomers.slice(0, idx+1);

        newStrand.monomers[0].n5 = undefined;
        e.n3 = undefined;

        this.strands.push(newStrand);
    }

    getSequence() {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strand = this.getStrandInOrder(this.strands[0]);
            return strand.map(e=>e.type).join('');
        }
    }

    setSequence(sequence) {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strand = this.getStrandInOrder(this.strands[0]);
            if(sequence.length == strand.length) {
                strand.forEach((e,i)=>{
                    e.type = sequence[i].toUpperCase();
                });
                console.log("Changed sequence to "+sequence.toUpperCase());
            }
        }
    }

    getStrandInOrder(strand) {
        let [,p5] = this.findById(strand.end5);
        console.assert(p5.n5 === undefined, "No end?")
        let [,p3] = this.findById(strand.end3);
        console.assert(p3.n3 === undefined, "No end?")
        let strandInOrder = []
        while(true) {
            if(strandInOrder.length > strand.monomers.length) {
                throw 'Circular strand?';
            }
            strandInOrder.push(p5);
            if(p5 === p3) {
                break;
            }
            [,p5] = this.findById(p5.n3);
        }
        console.assert(strandInOrder.length == strand.monomers.length, "Missed some elements");
        return strandInOrder;
    }

    getDotBracket() {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strandInOrder = this.getStrandInOrder(this.strands[0]);
            let s = "";
            for (let i=0; i < strandInOrder.length; i++) {
                if (strandInOrder[i].bp !== undefined) {
                    let j = strandInOrder.findIndex(e=>e.id == strandInOrder[i].bp);
                    if (j<0) {
                        throw 'Paired outside strand: ' + strandInOrder[i].id;
                    }
                    if (i<j) {
                        s += '(';
                    } else if (j<i) {
                        s += ')';
                    } else {
                        throw 'Element paired with itself: ' + strandInOrder[i].id;
                    }
                } else {
                    s += '.';
                }
            }
            return s;
        }
    }
}