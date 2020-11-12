/*
Polycube SAT specification adapted from Lukas chrystal one.

"Atoms" are "movable and rotatable", have 6 slots
"Positions" are fixed in the crystal, have 6 slots and bind according to spec
The problem has 2 parts:
A. find color bindings and colorings of position slots where each patch neightbors according to crystal model have
    colors that bind
B. find colorings of atoms s.t. all crystal positions are identical to (some) species rotation. The species definitions
    must not allow for (const bad 2-binds

indexes:
- colors:   1...c...//c (variable number)
- atoms:    1...s...//s (variable number)
- slots:    0...p...5=//p-1 (bindings places on atoms - 0,1,2 on one side, 3,4,5 on the other)
- position: 1...l...16=//l (number of positions in the crystal)
- rotation: 1...r...6=//r possible rotations of an species
- condition: 1...d...//d conditions to avoid bad crystal
- qualification: 0..//q (0 for (const good crystal, one more for (const each bad one)

(boolean) variables:
- B(c1, c2) { color c1 binds with c2 (n=#c*#c)
- F(l, p, c) { patch p at position l has color c (n=#l*#p*#c)
- C(s, p, c) { patch p on species s has color c (n=//s*#p*#c)
- P(l, s, r) { position l is occupied by species s with rotation r (n=#l*#s*#r)

encoding functions:
- rotation(p, r) = patch that p rotates to under rotation r
*/


//Polycube SAT Solver
class polysat {
    constructor(coords, nCubeTypes, nColors, nDim=3, tortionalPatches=true) {
        let [topology, empty] = topFromCoords(coords, nDim);

        // Different color coding, color n binds not to -n but
        // to another m, also ignore 0 and 1.
        let nC = (nColors + 1) * 2;

        // Read number of particles from the topology
        let [nL, _] = countParticlesAndBindings(topology);

        //problem specification:
        this.nS = nCubeTypes  //: Number of distinct particle types for (const the solver
        this.nC = nC  //: Number of colors in the whole system
        this.nL = nL  //: Numper of particle positions in the crystal lattice
        this.nD = nDim  //: Number of dimensions
        this.nP = 6   //: Number of patches on a single particle
        this.tortionalPatches = tortionalPatches; //tortionalPatches and nD > 2 // only tortion for
        if (this.tortionalPatches) {
            this.nO = 4   //: Number of possible orientations for (const a patch, N,S,W,E
        }
        this.rotations = enumerateRotations(this.nD);
        this.nR = this.rotations.size;

        this.variables = new Map();
        this.basic_sat_clauses = null;       //  string of s basic sat clause
        this.additional_sat_clauses = null;  //  some additional conditions
        this.BCO_varlen = null;              //  the number of clauses that determine B and C

        this.set_crystal_topology(topology);
        this.generate_constraints();

        // Solution must use all particles
        this.add_constraints_all_particles();

        // Solution must use all patches, except color 0 which should not bind
        this.add_constraints_all_patches_except(0);

        // A color cannot bind to itself
        this.add_constraints_no_self_complementarity();

        // Make sure color 0 binds to 1 and nothing else
        this.fix_color_interaction(0, 1);

        // Fix interaction matrix, to avoid redundant solution
        for (const c of range(2, nC-1, 2)) {
            this.fix_color_interaction(c, c+1);
        }

        if (nDim == 3 && tortionalPatches) {
            this.add_constraints_fixed_blank_orientation();
        }

        for (const [particle, patch] of empty) {
            this.fix_slot_colors(particle, patch, 1);
            //console.log("Particle {} patch {} should be empty".format(particle, patch))
        }
    }

    set_crystal_topology(bindings) {
        /**
        Accepts an array of integer tuples bindings, of format [particle_id1,patch1,particle_id_2,patch2], where particle_id1 uses patch1 to bind to particle_id2 on patch2
        Each interacting pair is only to be listed once
        */
        this.bindings = new Map();
        for (const [p1, s1, p2, s2] of bindings) {
            this.bindings.set([p1, s1], [p2, s2]);
        }
        //this.check_bindings();
    }

    B (c1, c2) {
        // color c1 binds with c2
        if (c2 < c1) {
            [c1, c2] = [c2, c1];
        }
        //console.assert(0 <= c1 <= c2 && c1 <= c2 < this.nC, `c1 <= c2 out of bounds 0 <= ${c1 <= c2} < ${this.nC}`);
        //print >> sys.stderr, 'B({c1},{c2})'.format(c1=c1, c2=c2)
        return this.variables.setdefault(`B(${c1},${c2})`, this.variables.size + 1)
    }

    D (p1, o1, p2, o2) {
        // patch p1, orientation c1 binds with patch p2, orientation c2 //
        if (p2 < p1) {
            [o1, o2] = [o2, o1];
            [p1, p2] = [p2, p1];
        }
        //console.assert(0 <= p1 <= p2 && p1 <= p2 < this.nP, `p1 <= p2 out of bounds 0 <= ${p1 <= p2} < ${this.nP}`);
        console.assert(0 <= o1 && o1 < this.nO, `o1 out of bounds 0 <= ${o1} < ${this.nO}`);
        console.assert(0 <= o2 && o2 < this.nO, `o2 out of bounds 0 <= ${o2} < ${this.nO}`);
        return this.variables.setdefault(`D(${p1},${o1},${p2},${o2})`, this.variables.size + 1)
    }

    F (l, p, c) {
        // patch p at position l has color c //
        console.assert(0 <= l && l < this.nL, `l out of bounds 0 <= ${l} < ${this.nL}`);
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= c && c < this.nC, `c out of bounds 0 <= ${c} < ${this.nC}`);
        return this.variables.setdefault(`F(${l},${p},${c})`, this.variables.size + 1)
    }

    A (l, p, o) {
        // patch p at position l has orientation o //
        console.assert(0 <= l && l < this.nL, `l out of bounds 0 <= ${l} < ${this.nL}`);
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= o && o < this.nO, `o out of bounds 0 <= ${o} < ${this.nO}`);
        return this.variables.setdefault(`A(${l},${p},${o})`, this.variables.size + 1)
    }

    C (s, p, c) {
        // patch p on species s has color c //
        console.assert(0 <= s && s < this.nS, `s out of bounds 0 <= ${s} < ${this.nS}`);
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= c && c < this.nC, `c out of bounds 0 <= ${c} < ${this.nC}`);
        return this.variables.setdefault(`C(${s},${p},${c})`, this.variables.size + 1)
    }

    O (s, p, o) {
        // patch p on species s has orientation o //
        console.assert(0 <= s && s < this.nS, `s out of bounds 0 <= ${s} < ${this.nS}`);
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= o && o < this.nO, `o out of bounds 0 <= ${o} < ${this.nO}`);
        return this.variables.setdefault(`O(${s},${p},${o})`, this.variables.size + 1)
    }

    P (l, s, r) {
        // position l is occupied by species s with rotation r //
        console.assert(0 <= l && l < this.nL, `l out of bounds 0 <= ${l} < ${this.nL}`);
        console.assert(0 <= s && s < this.nS, `s out of bounds 0 <= ${s} < ${this.nS}`);
        console.assert(0 <= r && r < this.nR, `r out of bounds 0 <= ${r} < ${this.nR}`);
        return this.variables.setdefault(`P(${l},${s},${r})`, this.variables.size + 1)
    }

    rotation (p, r) {
        // patch that p rotates to under rotation r //
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= r && r < this.nR, `r out of bounds 0 <= ${r} < ${this.nR}`);
        // console.assert(all(len(set(rotations[r].keys())) == nP for (const r in rotations))
        // console.assert(all(len(set(rotations[r].values())) == nP for (const r in rotations))
        console.assert(this.rotations.size == this.nR)
        console.assert(this.rotations.has(r))
        console.assert(this.rotations.get(r).has(p))
        return this.rotations.get(r).get(p)
    }

    orientation (p, r, o) {
        // new orientation for (const patch p with initial orientation o after getting rotated by r //
        console.assert(0 <= p && p < this.nP, `p out of bounds 0 <= ${p} < ${this.nP}`);
        console.assert(0 <= r && r < this.nR, `r out of bounds 0 <= ${r} < ${this.nR}`);
        console.assert(0 <= o && o < this.nO, `o out of bounds 0 <= ${o} < ${this.nO}`);
        console.assert(this.rotations.size == this.nR)
        console.assert(this.rotations.has(r))
        console.assert(this.rotations.get(r).has(p))

        // Calculate patch that p rotates to:
        let p_rot = this.rotations.get(r).get(p)
         // Calculate vector corresponding to o
        let v = patchRotToVec(p, o)
        // Which p has the same vector as o?
        let p_temp = getRuleOrder().findIndex(e=>e.equals(v))
        //assert(p != p_temp)
        // How would that p get rotated?
        let p_temp_rot = this.rotations.get(r).get(p_temp)
        //assert(p_rot != p_temp_rot)
        // And what vector does that correspond to?
        let v_rot = getRuleOrder()[p_temp_rot]
        // And what orientation value does that give us?
        return patchVecToRot(p_rot, v_rot)
    }

    check_settings() {
        console.assert(this.bindings.length == (this.nL * this.nP) / 2.0)
        console.assert(new Set(this.bindings.values()).size == this.bindings.length);
        //console.assert((new Set(this.bindings) | new Set(this.bindings.values())).size == this.nL * this.nP)
        //console.assert(Math.min([s for (const s, _ in this.bindings] + [s for (const _, s in this.bindings] + [s for (const s, _ in this.bindings.values()] + [s for (const _, s in this.bindings.values()]) == 0)
        //console.assert(Math.max([s for (const s, _ in this.bindings] + [s for (const s, _ in this.bindings.values()]) == this.nL - 1)
        //console.assert(Math.max([s for (const _, s in this.bindings] + [s for (const _, s in this.bindings.values()]) == this.nP - 1)
        for (const p of range(this.nP)) {
            for (const r of range(this.nR)) {
                this.rotation(p, r);
            }
        }
    }

    exactly_one(vs) {
        // returns a list of constraints implementing "exacly one of vs is true" //
        console.assert(vs.every(v=>v>0));
        console.assert(vs.length > 1);
        vs.sort((a,b)=>{return a-b}); // Sort numerically
        let constraints = [vs];
        for (const v1 of vs) {
            for (const v2 of vs) {
                if (v2 >= v1) {
                    break;
                }
                constraints.push([-v1, -v2]);
            }
        }
        console.assert((new Set(constraints)).size == (vs.length * (vs.length-1)) / 2 + 1)
        return constraints;
    }

    generate_constraints() {
        // make sure B, C and O vars are first:
        for (const c1 of range(this.nC)) {
            for (const c2 of range(this.nC)) {
                this.B(c1, c2)
            }
        }
        for (const s of range(this.nS)) {
            for (const p of range(this.nP)) {
                for (const c of range(this.nC)) {
                    this.C(s, p, c);
                }
            }
        }
        if (this.tortionalPatches) {
            for (const s of range(this.nS)) {
                for (const p of range(this.nP)) {
                    for (const o of range(this.nO)) {
                        this.O(s, p, o);
                    }
                }
            }
        }

        //console.log('c settings: nS=%d nC=%d nP=%d ' % (nS, nC, nP) )
        //console.log('c Last B and C var number: %s' % variables.length)
        this.basic_sat_clauses = [];
        //this.basic_sat_clauses.push('c settings: nS=%d nC=%d nP=%d ' % (this.nS, this.nC, this.nP) )
        //this.basic_sat_clauses.push('c Last B and C var number: %s' % this.variables.size)
        this.BCO_varlen = this.variables.size;

        // BASIC THINGS:
        // - Legal color bindings:
        // "Each color has exactly one color that it binds to"
        // 	forall c1 exactly one c2 s.t. B(c1, c2)
        for (const c1 of range(this.nC)) {
            this.basic_sat_clauses.push(...this.exactly_one([...range(this.nC)].map(c2=>this.B(c1, c2))))
            //print >> sys.stderr, [B(c1, c2) for (const c2 of range(nC) if c2 != c1]
        }

        // - Legal species patch coloring (unnecesay, implied by "Legal species coloring in positions" and "Legal position
        //   patch coloring") {
        // "Each patch on every species has exactly one color"
        //   forall s, forall p, exactly one c p.t. C(s, p, c)
        for (const s of range(this.nS)) {
            for (const p of range(this.nP)) {
                this.basic_sat_clauses.push(...this.exactly_one([...range(this.nC)].map(c=>this.C(s, p, c))));
            }
        }

        // - Legal species patch orientation
        // "Each patch on every species has exactly one orientation"
        //   forall s, forall p, exactly one o p.t. O(s, p, o)
        if (this.tortionalPatches) {
            for (const s of range(this.nS)) {
                for (const p of range(this.nP)) {
                    this.basic_sat_clauses.push(...this.exactly_one([...range(this.nO)].map(o=>this.O(s, p, o))));
                }
            }
        }


        // ADD CRYSTAL and COLORS:
        // - Legal position patch coloring:
        // "Every position patch has exactly one color"
        // 	for (const all l, p exactly one c st. F(l, p, c)
        for (const l of range(this.nL)) {
            for (const p of range(this.nP)) {
                this.basic_sat_clauses.push(...this.exactly_one([...range(this.nC)].map(c=>this.F(l, p, c))))
            }
        }

        // - Legal position patch orientation:
        // "Every position patch has exactly one orientation"
        // 	for (const all l, p exactly one o st. A(l, p, o)
        if (this.tortionalPatches) {
            for (const l of range(this.nL)) {
                for (const p of range(this.nP)) {
                    this.basic_sat_clauses.push(...this.exactly_one([...range(this.nO)].map(o=>this.A(l, p, o))))
                }
            }
        }

        // - Forms desired crystal:
        // "Specified binds have compatible colors"
        // 	forall (l1, p1) binding with (l2, p2) from crystal spec:
        // 		forall c1, c2: F(l1, p1, c1) and F(l2, p2, c2) => B(c1, c2)
        for (const [[l1, p1], [l2, p2]] of this.bindings) {
            for (const c1 of range(this.nC)) {
                for (const c2 of range(this.nC)) {
                    this.basic_sat_clauses.push([-this.F(l1, p1, c1), -this.F(l2, p2, c2), this.B(c1, c2)])
                }
            }
        }

        // - Forms desired crystal:
        // "Specified binds have compatible orientations"
        // 	forall (l1, p1) binding with (l2, p2) from crystal spec:
        // 		forall o1, o2: A(l1, p1, o1) and A(l2, p2, o2) => D(c1, c2)
        if (this.tortionalPatches) {
            for (const [[l1, p1], [l2, p2]] of this.bindings) {
                for (const o1 of range(this.nO)) {
                    for (const o2 of range(this.nO)) {
                        this.basic_sat_clauses.push([-this.A(l1, p1, o1), -this.A(l2, p2, o2), this.D(p1, o1, p2, o2)])
                    }
                }
            }
        }

        // Hard-code patch orientations to bind only if they point in the same direction
        if (this.tortionalPatches) {
            for (const p1 of range(this.nP)) {
                for (const p2 of range(this.nP)) {
                    if (p2 >= p1) {
                        break
                    }
                    for (const o1 of range(this.nO)) {
                        for (const o2 of range(this.nO)) {
                            const v1 = patchRotToVec(p1, o1)
                            const v2 = patchRotToVec(p2, o2)
                            // Do they point in the same global direction?
                            // And do the patches face each other?
                            if (v1.equals(v2) && p2+1 == p1) {
                                this.basic_sat_clauses.push([this.D(p1, o1, p2, o2)])
                            }
                            else {
                                this.basic_sat_clauses.push([-this.D(p1, o1, p2, o2)])
                            }
                        }
                    }
                }
            }
        }

        // - Legal species placement in positions:
        // "Every position has exactly one species placed there with exactly one rotation"
        //   forall l: exactly one s and r p.t. P(l, s, r)
        for (const l of range(this.nL)) {
            let ps = [];
            for (const r of range(this.nR)) {
                for (const s of range(this.nS)) {
                    ps.push(this.P(l, s, r))
                }
            }
            this.basic_sat_clauses.push(...this.exactly_one(ps))
        }

        // - Legal species coloring in positions:
        // "Given a place, species and its rotation, the patch colors on the position and (rotated) species must be the same"
        //   for (const all l, s, r:
        //       P(l, s, r) => (forall p, c: F(l, p, c) <=> C(s, rotation(p, r), c))
        for (const l of range(this.nL)) {
            for (const s of range(this.nS)) {
                for (const r of range(this.nR)) {
                    // forall part
                    for (const p of range(this.nP)) {
                        for (const c of range(this.nC)) {
                            const p_rot = this.rotation(p, r) // Patch after rotation
                            // Species 's' rotated by 'r' gets color 'c' moved from patch 'p' to 'p_rot':
                            this.basic_sat_clauses.push([
                                -this.P(l, s, r), // EITHER no species 's' at position 'l' with rot 'r'
                                -this.F(l, p, c), // OR no patch 'p' at position 'l' with color 'c'
                                this.C(s, p_rot, c) // OR patch 'p_rot' on species 's' DOES have the color 'c'
                            ]);
                            this.basic_sat_clauses.push([
                                -this.P(l, s, r), // EITHER no species 's' at position 'l' with rot 'r'
                                this.F(l, p, c), // OR there is a patch 'p' at position 'l' with color 'c'
                                -this.C(s, p_rot, c) // OR there is no patch 'p_rot' on species 's' with the color 'c'
                            ]);
                        }
                    }
                }
            }
        }


        // - Legal species patch orientation in positions:
        // "Given a place, species and its rotation, the patch orientations on the position and (rotated) species must be correct"
        //   for (const all l, s, r:
        //       P(l, s, r) => (forall p, c: F(l, p, c) <=> C(s, rotation(p, r), c))
        if (this.tortionalPatches) {
            for (const l of range(this.nL)) {
                for (const s of range(this.nS)) {
                    for (const r of range(this.nR)) {
                        for (const p of range(this.nP)) {
                            for (const o of range(this.nO)) {
                                const p_rot = this.rotation(p, r) // Patch after rotation
                                const o_rot = this.orientation(p, r, o) // Patch orientation after rotation
                                // Species 's' rotated by 'r' gets orientation 'o' of patch 'p' changed to 'o_rot' at the new path 'p_rot':
                                //console.log("Species {} rotated by {}: patch {}-->{}, orientation {}-->{}".format(s, r, p, p_rot, o, o_rot))
                                this.basic_sat_clauses.push([ 
                                    -this.P(l, s, r), // EITHER no species 's' at position 'l' with rot 'r'
                                    -this.A(l, p, o), // OR no patch 'p' at position 'l' with orientation 'o'
                                    this.O(s, p_rot, o_rot) // OR patch 'p_rot' on species 's' has the orientation 'o_rot'
                                ])
                                this.basic_sat_clauses.push([
                                    -this.P(l, s, r), // EITHER no species 's' at position 'l' with rot 'r'
                                    this.A(l, p, o), // OR there is a patch 'p' at position 'l' with orientation 'o'
                                    -this.O(s, p_rot, o_rot) // OR there is no patch 'p_rot' on species 's' with the orientation 'o_rot'
                                ])
                            }
                        }
                    }
                }
            }
        }
        
        if (this.nD == 2) {
            // Lock patch orientation if 2D
            for (const s of range(this.nS)) {
                for (const p of range(this.nP)) {
                    if (p>3) {
                        // Patch p on species s is empty
                        this.basic_sat_clauses.push([this.C(s, p, 1)])
                    }
                    o = getFlatFaceRot()[p]
                    // Patch p has orientation 'o'
                    this.basic_sat_clauses.push([this.O(s, p, o)])
                }
            }
        }
    }


    output_cnf(constraints) {
        // Outputs a CNF formula //
        let num_vars = Math.max(...this.variables.values());
        let num_constraints = constraints.length;
        let outstr = `p cnf ${num_vars} ${num_constraints}\n`;
        for (const c of constraints) {
            outstr += c.join(' ') + ' 0\n';
        }
        return outstr;
    }


    load_solution_from_lines(lines) {
        // loads solution from sat solution output in s string//
        let satline;
        if (lines.length > 1) {
            console.assert(lines[0].strip() == 'SAT')
            satline = lines[1].strip().split()
        }
        else {
            satline = lines[0].strip().split()
        }

        //line = myinput.readline().strip()
        console.assert(line == 'SAT')
        let sols = satline.map(v=>Math.floor(v))
        console.assert(sols[-1] == 0)
        sols.pop(); //Remove last element
        console.assert(sols.length <= this.variables.size)

        let vnames = []
        for (const [vname, vnum] in this.variables) {
            if (sols.includes(vnum)) {
                vnames.push(vname);
            }
        }
        return vnames;
    }

    add_constraints_from_vnames(vnames) {
        let constraints = []
        for (const vname of vnames) {
            if (!this.variables.includes(vname)) {
                console.error("Trying to add variables that have not been defined, probably incompatible problem formulation?")
            }
            constraints.push(this.variables[vname])
        }
        this.basic_sat_clauses.push(constraints);
    }

    convert_solution(solution) {
        // loads solution from minisat sol in myinput handle, writes variable names to output //
        let lines = solution.split(' ');
        console.assert(lines[0] == 'SAT')
        let sols = lines.slice(1);
        //console.assert(sols[-1] == 0)
        sols.pop();
        console.assert(sols.length <= this.variables.size)

        let output = '';

        for (const vname of [...this.variables.keys()].sort()) {
            const vnum = this.variables.get(vname);
            if (vnum > sols.length) {
                break;
            }
            if (sols[vnum-1] > 0) {
                output += vname+'\n';
            }
        }
        return output;
    }

    run_minisat () {
        let cnf = this.output_cnf(this.basic_sat_clauses)
        let out = minisat(cnf)
        let result = out.split(' ')[0]
        if (result == 'UNSAT') {
            return false;
        } else if (result == 'SAT') {
            return this.convert_solution(out);
        } else {
            console.error("Unknown output"+result)
        }
    }

    add_constraints_all_particles() {
        for (const s of range(this.nS)) {
            let ps = [];
            for (const r of range(this.nR)){
                for (const l of range(this.nL)) {
                    ps.push(this.P(l,s,r));
                }
            }
            this.basic_sat_clauses.push(ps);
        }
    }

    add_constraints_all_patches_except(forbidden) {
        for (const c of range(this.nC)) {
            if (c != forbidden) {
                let cs = [];
                for (const s of range(this.nS)){
                    for (const p of range(this.nP)) {
                        cs.push(this.C(s, p, c));
                    }
                }
                this.basic_sat_clauses.push(cs)
            }
            // Do not use forbidden color
            for (const p of range(this.nP)) {
                for (const s of range(this.nS)) {
                    this.basic_sat_clauses.push(
                            [-this.C(s, p, forbidden)]
                    )
                }
            }
        }
    }

    add_constraints_fixed_blank_orientation() {
        for (const p of range(this.nP)) {
            for (const s of range(this.nS)) {
                this.basic_sat_clauses.push([
                    -this.C(s, p, 1), // Either patch p on species s isn't empty
                     this.O(s, p, 0)  // Or the patch is oriented up
                ]);
            }
        }
    }


    add_constraints_no_self_complementarity(above_color=0) {
        for (const c of range(above_color,this.nC)) {
            this.basic_sat_clauses.push([-this.B(c,c)]);
        }
    }

   
    fix_slot_colors(ptype, sid, cid) {
        this.basic_sat_clauses.push([this.F(ptype, sid, cid)]);
    }

    fix_color_interaction(c1, c2) {
        this.basic_sat_clauses.push([this.B(c1,c2)])
    }

    forbidSolution(solution) {
        let forbidden = [];
        for (const vname of solution.split('\n')) {
            if (vname.includes('C') || vname.includes('O')) {
                forbidden.push(-this.variables.get(vname));
            }
        }
        this.basic_sat_clauses.push(forbidden);
    }
}

////// Helper functions:

function getRuleOrder(nDim=3) {
    if (nDim == 2) {
        return [
            new THREE.Vector2(0, -1),
            new THREE.Vector2(1, 0),
            new THREE.Vector2(0, 1),
            new THREE.Vector2(-1, 0)
        ]
    }
    else {    
        return [
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3( 1, 0, 0),
            new THREE.Vector3( 0,-1, 0),
            new THREE.Vector3( 0, 1, 0),
            new THREE.Vector3( 0, 0,-1),
            new THREE.Vector3( 0, 0, 1),
        ]
    }
}

function getFaceRotations() {
    return [
        new THREE.Vector3( 0,-1, 0),
        new THREE.Vector3( 0, 1, 0),
        new THREE.Vector3( 0, 0,-1),
        new THREE.Vector3( 0, 0, 1),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3( 1, 0, 0),
    ];
}

function getFlatFaceRot() {
    return [1,1,2,0,0,0]
}

function getSignedAngle(v1, v2, axis) {
    let s = v1.clone().cross(v2);
    let c = v1.clone().dot(v2);
    let a = Math.atan2(s.length(), c);
    if (!s.equals(axis)) {
        a *= -1;
    }
    return a;
}

function patchRotToVec(i, rot) {
    /** Get vector indicating patch rotation, given rotation state and face index

    Args:
        i (Math.floor) { Index of patch [0...5]
        rot (Math.floor) { Rotation state [0,1,2,3] = North , East, South, West

    Returns:
        vector: Patch rotation vector
    */

    let v = getFaceRotations()[i];
    let axis = getRuleOrder()[i];
    let angle = rot * Math.PI/2;
    let q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    return v.clone().applyQuaternion(q).round();
}

function patchVecToRot(i, v) {
    /** Get rotation state, given face index and patch rotation vector

    Args:
        i (Math.floor) { Index of patch [0...5]
        v (vector) { Patch rotation vector

    Returns:
        Math.floor: Rotation state [0,1,2,3] = North , East, South, West
    */
    let angle = getSignedAngle(
        getFaceRotations()[i],
        v,
        getRuleOrder()[i]
    )
    return Math.floor((angle * (2/Math.PI)+4) % 4)
}


function enumerateRotations(dim=3) {
    if (dim==2) {
        return new Map([
            [0, new Map([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])],
            [1, new Map([[0, 1], [1, 0], [2, 3], [3, 2], [4, 4], [5, 5]])],
            [2, new Map([[0, 2], [1, 3], [2, 1], [3, 0], [4, 4], [5, 5]])],
            [3, new Map([[0, 3], [1, 2], [2, 0], [3, 1], [4, 4], [5, 5]])]
        ]);
    } else {
        return new Map([
            [0,  new Map([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]])],
            [1,  new Map([[0, 0], [1, 1], [2, 3], [3, 2], [4, 5], [5, 4]])],
            [2,  new Map([[0, 0], [1, 1], [2, 4], [3, 5], [4, 3], [5, 2]])],
            [3,  new Map([[0, 0], [1, 1], [2, 5], [3, 4], [4, 2], [5, 3]])],
            [4,  new Map([[0, 1], [1, 0], [2, 2], [3, 3], [4, 5], [5, 4]])],
            [5,  new Map([[0, 1], [1, 0], [2, 3], [3, 2], [4, 4], [5, 5]])],
            [6,  new Map([[0, 1], [1, 0], [2, 4], [3, 5], [4, 2], [5, 3]])],
            [7,  new Map([[0, 1], [1, 0], [2, 5], [3, 4], [4, 3], [5, 2]])],
            [8,  new Map([[0, 2], [1, 3], [2, 0], [3, 1], [4, 5], [5, 4]])],
            [9,  new Map([[0, 2], [1, 3], [2, 1], [3, 0], [4, 4], [5, 5]])],
            [10, new Map([[0, 2], [1, 3], [2, 4], [3, 5], [4, 0], [5, 1]])],
            [11, new Map([[0, 2], [1, 3], [2, 5], [3, 4], [4, 1], [5, 0]])],
            [12, new Map([[0, 3], [1, 2], [2, 0], [3, 1], [4, 4], [5, 5]])],
            [13, new Map([[0, 3], [1, 2], [2, 1], [3, 0], [4, 5], [5, 4]])],
            [14, new Map([[0, 3], [1, 2], [2, 4], [3, 5], [4, 1], [5, 0]])],
            [15, new Map([[0, 3], [1, 2], [2, 5], [3, 4], [4, 0], [5, 1]])],
            [16, new Map([[0, 4], [1, 5], [2, 0], [3, 1], [4, 2], [5, 3]])],
            [17, new Map([[0, 4], [1, 5], [2, 1], [3, 0], [4, 3], [5, 2]])],
            [18, new Map([[0, 4], [1, 5], [2, 2], [3, 3], [4, 1], [5, 0]])],
            [19, new Map([[0, 4], [1, 5], [2, 3], [3, 2], [4, 0], [5, 1]])],
            [20, new Map([[0, 5], [1, 4], [2, 0], [3, 1], [4, 3], [5, 2]])],
            [21, new Map([[0, 5], [1, 4], [2, 1], [3, 0], [4, 2], [5, 3]])],
            [22, new Map([[0, 5], [1, 4], [2, 2], [3, 3], [4, 0], [5, 1]])],
            [23, new Map([[0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0]])]
        ]);

    }   
}


function topFromCoords(coords, nDim=3) {
    neigbourDirs = getRuleOrder(nDim)

    bindings = []
    empty = []
    donePairs = []  // Keep track so that only one bond per pair is saved

    // For each position
    coords.forEach((current, i)=> {
        // Enumerate von Neumann neighborhood
        neigbourDirs.forEach((dP,dPi)=>{
            neigbourPos = current.clone().add(dP);
            found = false;
            // Check if curerent neighbor is among the positions
            coords.forEach((other,j)=>{
                if (neigbourPos.equals(other)) {
                    if (!donePairs.includes((j, i))) {
                        bindings.push([
                            // Particle {} patch {} 
                            i, dPi,
                            // with Particle {} patch {}
                            j, dPi + (dPi % 2 == 0 ? 1 : -1)
                        ])
                        donePairs.push([i, j])
                    }
                    found = true;
                }
            });
            // If the current neigbour is empty, save
            if (!found) {
                empty.push([i, dPi])
            }
        });
    });
    return [bindings, empty]
}

// https://stackoverflow.com/a/45054052
function parseHexRule(ruleStr) {
    let ruleSize = 6;
    let rule = [];
    for (let i=0; i<ruleStr.length; i+=2*ruleSize) {
        let cube = [];
        for (let j = 0; j<ruleSize; j++) {
            let face = ruleStr.substring(i+(2*j), i+(2*j) + 2);
            let binStr = (parseInt(face, 16).toString(2)).padStart(8, '0');
            let sign = parseInt(binStr[0], 2);
            let color = parseInt(binStr.substring(1,6),2);
            let orientation = parseInt(binStr.substring(6,8),2);
            cube.push( {'color': color * (sign ? -1:1), 'orientation': orientation} );
        }
        rule.push(cube);
    }
    return rule;
}

function ruleToHex(rule) {
    let ruleSize = 6;
    let ruleStr = "";
    for (let i=0; i< rule.length; i++) {
        for (let j = 0; j<ruleSize; j++) {
            let face = rule[i][j];
            let sign = face.color < 0 ? "1" : "0";
            let color = Math.abs(face.color).toString(2).padStart(5,'0');
            let orientation = face.orientation.toString(2).padStart(2,'0');
            let binStr = sign + color + orientation;
            let hexStr = parseInt(binStr,2).toString(16).padStart(2,'0');
            ruleStr += hexStr;
        }
    }
    return ruleStr;
}

function translateToPolyominoNotation(ruleset) {
    faceOrder = [1,3,0,2]
    cubes = []
    for (const cube of ruleset) {
        faces = [];
        for (const i of faceOrder) {
            face = cube[i]
            color = 2*abs(face['color']);
            if (face['color'] < 0) {
                color -= 1;
            }
            faces.push(str(color))
        }
        cubes.push(" ".join(faces));
    }
    return cubes.join(" | ");
}

function readSolution(sol) {
    let colorCounter = 1;
    let colorMap = new Map();
    let ruleMap = new Map();
    let bMatches = sol.matchAll(/B\((\d+),(\d+)\)/g);
    for (const m of bMatches) {  // color c1 binds with c2
        let b1 = Number(m[1]);
        let b2 = Number(m[2]);
        // console.log("Color {} binds with {}".format(c1, c2))
        console.assert(!colorMap.has(b1) || !colorMap.has(b2));
        if (b1 < 2 || b2 < 2) {
            colorMap.set(b1, 0);
            colorMap.set(b2, 0);
        } else {
            colorMap.set(b1, colorCounter);
            colorMap.set(b2, -colorCounter);
            colorCounter += 1;
        }
    }
    let cMatches = sol.matchAll(/C\((\d+),(\d+),(\d+)\)/g);
    for (const m of cMatches) {  // Patch p on species s has color c
        let s = Number(m[1]);
        let p = Number(m[2]);
        let c = Number(m[3]);
        //console.log("Patch {} on species {} has color {}".format(p, s, c))
        if (!ruleMap.has(s)) {
            ruleMap.set(s, new Map());
        }
        if (!ruleMap.get(s).has(p)) {
            ruleMap.get(s).set(p, {});
        }
        ruleMap.get(s).get(p).color = colorMap.get(c);
    }
    let hasOrientation = false;
    let oMatches = sol.matchAll(/O\((\d+),(\d+),(\d+)\)/g);
    for (const m of oMatches) {  // Patch on species l has orientation o
        let s = Number(m[1]);
        let p = Number(m[2]);
        let o = Number(m[3]);
        //console.log("Patch {} on species {} has orientation {}".format(p, s, o))
        hasOrientation = true;
        ruleMap.get(s).get(p).orientation = o;
    }
    if (!hasOrientation) {
        console.log("Found no orientation values")
        for (const patches of ruleMap.values()) {
            for (const [i, p] of patches) {
                p.orientation = getFlatFaceRot()[Number(i)];
            }
        }
    }
    return [...ruleMap.values()].map(rule=>[...rule.values()]);
}

function countParticlesAndBindings(topology) {
    pidsa = topology.map(x=>x[0]);
    pidsb = topology.map(x=>x[2]);
    particles = pidsa.concat(pidsb);
    return [Math.max(...particles)+1, topology.length]
}

function patchCount(cube) {
    return cube.filter(face=>face.color!=0).length;
}

let minSol = false;
function find_solution(coords, nCubeTypes, nColors, nDim=3, tortionalPatches=true) {
    // Initiate solver
    let mysat = new polysat(coords, nCubeTypes, nColors, nDim, tortionalPatches);

    let nMaxTries = 100;
    while (nMaxTries--) {
        if (minSol && minSol[0]+minSol[1] < nCubeTypes+nColors) {
            return 'skipped';
        }
        let result = mysat.run_minisat();
        if (result) {
            let rule = readSolution(result);
            rule.sort((a,b)=>{return patchCount(b)-patchCount(a)});
            let hexRule = ruleToHex(rule);
            if (isBoundedAndDeterministic(hexRule)) {
                minSol = [nCubeTypes, nColors];
                return hexRule;
            } else {
                updateStatus(`<a href="https://akodiat.github.io/polycubes/?rule=${hexRule}" target="_blank">UND</a> `, false);
                mysat.forbidSolution(result);
            }
        } else {
            return null;
        }
    }
    updateStatus('Gave up');
}

function smartEnumerate(xMax, yMax) {
    l = []
    for (const x of range(1, xMax+1)) {
        for (const y of range(1, yMax+1)) {
            l.push([x,y])
        }
    }
    return l.sort((a,b)=>{return (a[0]+a[1]) - (b[0]+b[1])})
}

function findMinimalRule(coords, maxCubeTypes='auto', maxColors='auto', nDim=3, tortionalPatches=true) {
    // Clear status
    document.getElementById('status').innerHTML = '';
    // Never need to check for (const more than the topology can specify
    let [topology, _] = topFromCoords(coords, nDim);
    let [maxNT, maxNC] = countParticlesAndBindings(topology);
    if (maxCubeTypes == 'auto') {
        maxCubeTypes = maxNT;
    }
    if (maxColors == 'auto') {
        maxColors = maxNC;
    }

    for (const [nCubeTypes, nColors] of smartEnumerate(maxCubeTypes, maxColors)) {
        setTimeout(()=>{
            updateStatus(`<b>${nColors} colors and ${nCubeTypes} cube types:</b>`);
            rule = find_solution(coords, nCubeTypes, nColors, nDim, tortionalPatches);
            if (rule == 'skipped') {
                updateStatus('Simpler solution already found');
            } else if (rule) {
                updateStatus(`Found solution: <a href="https://akodiat.github.io/polycubes/?rule=${rule}" target="_blank">${rule}</a>`);
                return rule;
            } else {
                updateStatus('Sorry, no solution')
            }
        }, 100);
    }
}

function updateStatus(status, newline=true) {
    console.log(status);
    let e = document.getElementById('status');
    e.innerHTML += newline ? `<p>${status}</p>` : status;
    e.scrollTop = e.scrollHeight;
}


// Modified from https://stackoverflow.com/a/8273091
function* range(start, stop, step) {
    if (typeof stop == 'undefined') {
        stop = start;
        start = 0;
    }
    if (typeof step == 'undefined') {
        step = 1;
    }
    let iterationCount = 0;
    if (!((step > 0 && start >= stop) || (step < 0 && start <= stop))) {
        for (var i = start; step > 0 ? i < stop : i > stop; i += step) {
            iterationCount++;
            yield i;
        }
    }
    return iterationCount;
};

/**
 * Emulating https://docs.python.org/3.8/library/stdtypes.html#dict.setdefault
 * If key is in the dictionary, return its value.
 * If not, insert key with a value of default and return default. default defaults to None.
 * @param {*} key 
 * @param {*} default_value 
 */
Map.prototype.setdefault = function (key, default_value=null) {
    if (!this.has(key)) {
        this.set(key, default_value);
    }
    return this.get(key);
}

// Adapted from demo: http://jgalenson.github.io/research.js/demos/minisat.html
function minisat(input) {
    //minisatModule.TOTAL_MEMORY = 1073741824;
    var solve_string = minisatModule.cwrap('solve_string', 'string', ['string', 'int']);
    var oldPrint = minisatModule.print;
    var oldPrintErr = minisatModule.printErr;
    let output = '';
    let result = '';
    minisatModule['print'] = function(x) {
        console.log(x);
        output += x + "\n";
    }
    minisatModule['printErr'] = function(x) {
        console.error(x);
        output += x + "\n";
    }
    try {
      var startTime = (new Date()).getTime();
      result = solve_string(input, input.length);
      var endTime = (new Date()).getTime();
      console.log('CPU time: ' + ((endTime - startTime) / 1000) + 's\n');
    } catch(e) {
      minisatModule.printErr('Error: ' + e);
    }
    minisatModule.print = oldPrint;
    minisatModule.printErr = oldPrintErr;
    return result;
}
