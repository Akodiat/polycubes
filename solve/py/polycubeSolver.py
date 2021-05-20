"""
Polycube SAT specification adapted from Lukas chrystal one.

"Atoms" are "movable and rotatable", have 6 slots
"Positions" are fixed in the crystal, have 6 slots and bind according to spec
The problem has 2 parts:
A. find color bindings and colorings of position slots where each patch neightbors according to crystal model have
    colors that bind
B. find colorings of atoms s.t. all crystal positions are identical to (some) species rotation. The species definitions
    must not allow for bad 2-binds

indexes:
- colors:   1...c...#c (variable number)
- atoms:    1...s...#s (variable number)
- slots:    0...p...5=#p-1 (bindings places on atoms - 0,1,2 on one side, 3,4,5 on the other)
- position: 1...l...16=#l (number of positions in the crystal)
- rotation: 1...r...6=#r possible rotations of an species
- condition: 1...d...#d conditions to avoid bad crystal
- qualification: 0..#q (0 for good crystal, one more for each bad one)

(boolean) variables:
- B(c1, c2): color c1 binds with c2 (n=#c*#c)
- F(l, p, c): patch p at position l has color c (n=#l*#p*#c)
- C(s, p, c): patch p on species s has color c (n=#s*#p*#c)
- P(l, s, r): position l is occupied by species s with rotation r (n=#l*#s*#r)

encoding functions:
- rotation(p, r) = patch that p rotates to under rotation r
"""

import subprocess
import os
import utils
import numpy as np
from pysat.formula import CNF
from pysat.solvers import Glucose4


#Polycube SAT Solver
class polysat:
    relsat_executable  = 'relsat'
    minisat_executable = 'minisat'

    def __init__(self, topology, nCubeTypes, nColors, nSolutions=1, nDim=3, torsionalPatches=True):
        #topology, empty = utils.topFromFile(topPath, nDim)

        # Number of distinct cube types for the solver
        self.nS = nCubeTypes

        # Different color coding, color n binds not to -n but
        # to another m, also ignore 0 and 1.
        self.nC = (nColors + 1) * 2

        # Read number of particles from the topology
        self.nL, _ = utils.countParticlesAndBindings(topology)

        self.nD = nDim  #: Number of dimensions
        self.nP = 6   #: Number of patches on a single particle
        self.torsionalPatches = torsionalPatches
        if self.torsionalPatches:
            self.nO = 4   #: Number of possible orientations for a patch, N,S,W,E
        self.rotations = utils.enumerateRotations()
        self.nR = len(self.rotations)

        self.variables = {}
        self.basic_sat_clauses = None       #  string of s basic sat clause
        self.additional_sat_clauses = None  #  some additional conditions
        self.BCO_varlen = None               #  the number of clauses that determine B and C

        self.set_crystal_topology(topology)
        self.generate_constraints()

        # Solution must use all particles
        #self.add_constraints_all_particles()

        # Solution must use all patches, except color 0 which should not bind
        self.add_constraints_all_patches_except(0)

        # A color cannot bind to itself
        self.add_constraints_no_self_complementarity()

        # Make sure color 0 binds to 1 and nothing else
        self.fix_color_interaction(0, 1)

        # Fix interaction matrix, to avoid redundant solution
        for c in range(2, self.nC-1, 2):
            self.fix_color_interaction(c, c+1)

        if nDim == 3 and torsionalPatches:
            self.add_constraints_fixed_blank_orientation()

        empty = utils.calcEmptyFromTop(topology)

        for particle, patch in empty:
            self.fix_slot_colors(particle, patch, 1)
            #print("Particle {} patch {} should be empty".format(particle, patch))

    def check_bindings(self):
        bindings = self.bindings
        pids = [x[0] for x in bindings.keys()] + [x[0] for x in bindings.values()]
        nL = 1 + max(pids)
        sids = [x[1] for x in bindings.keys()] + [x[1] for x in bindings.values()]
        nP = 1 + max(sids)

        if self.nL is None:
            self.nL = nL
        elif self.nL != nL:
            raise IOError("Bindings text has different number of positions %d than imposed %d " % (self.nL,nL))

        if self.nP is None:
            self.nP = nP
        #elif self.nP != nP:
        #raise IOError("Bindings text has different number of patches than imposed")

        return True

    def set_crystal_topology(self,bindings):
        '''
        Accepts an array of integer tuples bindings, of format [particle_id1,patch1,particle_id_2,patch2], where particle_id1 uses patch1 to bind to particle_id2 on patch2
        Each interacting pair is only to be listed once
        '''
        self.bindings = {(int(p1), int(s1)): (int(p2), int(s2)) for (p1, s1, p2, s2) in bindings}
        self.check_bindings()

    def B(self,c1, c2):
        """ color c1 binds with c2 """
        if c2 < c1:
            c1, c2 = c2, c1
        assert 0 <= c1 <= c2 < self.nC
        #print >> sys.stderr, 'B({c1},{c2})'.format(c1=c1, c2=c2)
        return self.variables.setdefault('B({c1},{c2})'.format(c1=c1, c2=c2), len(self.variables) + 1)

    def D(self, p1, o1, p2, o2):
        """ patch p1, orientation o1 binds with patch p2, orientation o2 """
        if p2 < p1:
            o1, o2 = o2, o1
            p1, p2 = p2, p1
        assert 0 <= p1 <= p2 < self.nP
        assert 0 <= o1 < self.nO
        assert 0 <= o2 < self.nO
        return self.variables.setdefault('D({p1},{o1},{p2},{o2})'.format(p1=p1, o1=o1, p2=p2, o2=o2), len(self.variables) + 1)

    def F(self, l, p, c):
        """ patch p at position l has color c """
        assert 0 <= l < self.nL
        assert 0 <= p < self.nP
        assert 0 <= c < self.nC
        return self.variables.setdefault('F({l},{p},{c})'.format(l=l, p=p, c=c), len(self.variables) + 1)

    def A(self, l, p, o):
        """ patch p at position l has orientation o """
        assert 0 <= l < self.nL
        assert 0 <= p < self.nP
        assert 0 <= o < self.nO
        return self.variables.setdefault('A({l},{p},{o})'.format(l=l, p=p, o=o), len(self.variables) + 1)

    def C(self,s, p, c):
        """ patch p on species s has color c """
        assert 0 <= s < self.nS
        assert 0 <= p < self.nP
        assert 0 <= c < self.nC
        return self.variables.setdefault('C({s},{p},{c})'.format(s=s, p=p, c=c), len(self.variables) + 1)

    def O(self, s, p, o):
        """ patch p on species s has orientation o """
        assert 0 <= s < self.nS
        assert 0 <= p < self.nP
        assert 0 <= o < self.nO
        return self.variables.setdefault('O({s},{p},{o})'.format(s=s, p=p, o=o), len(self.variables) + 1)

    def P(self, l, s, r):
        """ position l is occupied by species s with rotation r """
        assert 0 <= l < self.nL
        assert 0 <= s < self.nS
        assert 0 <= r < self.nR
        return self.variables.setdefault('P({l},{s},{r})'.format(l=l, s=s, r=r), len(self.variables) + 1)

    def rotation(self,p, r):
        """ patch that p rotates to under rotation r """
        assert 0 <= p < self.nP
        assert 0 <= r < self.nR
        # assert all(len(set(rotations[r].keys())) == nP for r in rotations)
        # assert all(len(set(rotations[r].values())) == nP for r in rotations)
        assert len(self.rotations) == self.nR
        assert r in self.rotations
        assert p in self.rotations[r]
        return self.rotations[r][p]

    def orientation(self,p, r, o):
        """ new orientation for patch p with initial orientation o after getting rotated by r """
        assert 0 <= p < self.nP
        assert 0 <= r < self.nR
        assert 0 <= o < self.nO
        assert len(self.rotations) == self.nR
        assert r in self.rotations
        assert p in self.rotations[r]

        # Calculate patch that p rotates to:
        p_rot = self.rotations[r][p]
         # Calculate vector corresponding to o
        v = utils.patchRotToVec(p, o)
        # Which p has the same vector as o?
        p_temp = utils.getIndexOf(v, utils.getRuleOrder())
        assert(p != p_temp)
        # How would that p get rotated?
        p_temp_rot = self.rotations[r][p_temp]
        assert(p_rot != p_temp_rot)
        # And what vector does that correspond to?
        v_rot = utils.getRuleOrder()[p_temp_rot]
        # And what orientation value does that give us?
        return utils.patchVecToRot(p_rot, v_rot)

    def check_settings(self):
        assert len(self.bindings) == (self.nL * self.nP) / 2.0
        assert len(set(self.bindings.values())) == len(self.bindings)
        assert len(set(self.bindings) | set(self.bindings.values())) == self.nL * self.nP
        assert min([s for s, _ in self.bindings] + [s for _, s in self.bindings] +
                [s for s, _ in self.bindings.values()] + [s for _, s in self.bindings.values()]) == 0
        assert max([s for s, _ in self.bindings] + [s for s, _ in self.bindings.values()]) == self.nL - 1
        assert max([s for _, s in self.bindings] + [s for _, s in self.bindings.values()]) == self.nP - 1
        for p in range(self.nP):
            for r in range(self.nR):
                self.rotation(p, r)


    def _exactly_one(self,vs):
        """ returns a list of constraints implementing "exacly one of vs is true" """
        assert all(v > 0 for v in vs)
        assert len(vs) > 1
        constraints = [tuple(sorted(vs))]
        for v1 in sorted(vs):
            for v2 in sorted(vs):
                if v2 >= v1:
                    break
                constraints.append((-v1, -v2))
        assert len(set(constraints)) == (len(vs) * (len(vs)-1)) / 2 + 1
        return constraints


    def generate_constraints(self):
        # make sure B, C and O vars are first:
        for c1 in range(self.nC):
            for c2 in range(self.nC):
                self.B(c1, c2)
        for s in range(self.nS):
            for p in range(self.nP):
                for c in range(self.nC):
                    self.C(s, p, c)
        if self.torsionalPatches:
            for s in range(self.nS):
                for p in range(self.nP):
                    for o in range(self.nO):
                        self.O(s, p, o)

        #print('c settings: nS=%d nC=%d nP=%d ' % (nS, nC, nP) )
        #print('c Last B and C var number: %s' % len(variables))
        self.basic_sat_clauses = []
        #self.basic_sat_clauses.append('c settings: nS=%d nC=%d nP=%d ' % (self.nS, self.nC, self.nP) )
        #self.basic_sat_clauses.append('c Last B and C var number: %s' % len(self.variables))
        self.BCO_varlen = len(self.variables)
        constraints = []

        # BASIC THINGS:
        # - Legal color bindings:
        # "Each color has exactly one color that it binds to"
        # 	forall c1 exactly one c2 s.t. B(c1, c2)
        for c1 in range(self.nC):
            constraints.extend(self._exactly_one([self.B(c1, c2) for c2 in range(self.nC)]))
            #print >> sys.stderr, [B(c1, c2) for c2 in range(nC) if c2 != c1]

        # - Legal species patch coloring (unnecesay, implied by "Legal species coloring in positions" and "Legal position
        #   patch coloring"):
        # "Each patch on every species has exactly one color"
        #   forall s, forall p, exactly one c p.t. C(s, p, c)
        for s in range(self.nS):
            for p in range(self.nP):
                constraints.extend(self._exactly_one([self.C(s, p, c) for c in range(self.nC)]))

        # - Legal species patch orientation
        # "Each patch on every species has exactly one orientation"
        #   forall s, forall p, exactly one o p.t. O(s, p, o)
        if self.torsionalPatches:
            for s in range(self.nS):
                for p in range(self.nP):
                    constraints.extend(self._exactly_one([self.O(s, p, o) for o in range(self.nO)]))


        # ADD CRYSTAL and COLORS:
        # - Legal position patch coloring:
        # "Every position patch has exactly one color"
        # 	for all l, p exactly one c st. F(l, p, c)
        for l in range(self.nL):
            for p in range(self.nP):
                constraints.extend(self._exactly_one([self.F(l, p, c) for c in range(self.nC)]))

        # - Legal position patch orientation:
        # "Every position patch has exactly one orientation"
        # 	for all l, p exactly one o st. A(l, p, o)
        if self.torsionalPatches:
            for l in range(self.nL):
                for p in range(self.nP):
                    constraints.extend(self._exactly_one([self.A(l, p, o) for o in range(self.nO)]))

        # - Forms desired crystal:
        # "Specified binds have compatible colors"
        # 	forall (l1, p1) binding with (l2, p2) from crystal spec:
        # 		forall c1, c2: F(l1, p1, c1) and F(l2, p2, c2) => B(c1, c2)
        for (l1, p1), (l2, p2) in self.bindings.items():
            for c1 in range(self.nC):
                for c2 in range(self.nC):
                    constraints.append((-self.F(l1, p1, c1), -self.F(l2, p2, c2), self.B(c1, c2)))

        # - Forms desired crystal:
        # "Specified binds have compatible orientations"
        # 	forall (l1, p1) binding with (l2, p2) from crystal spec:
        # 		forall o1, o2: A(l1, p1, o1) and A(l2, p2, o2) => D(c1, c2)
        if self.torsionalPatches:
            for (l1, p1), (l2, p2) in self.bindings.items():
                for o1 in range(self.nO):
                    for o2 in range(self.nO):
                        constraints.append((-self.A(l1, p1, o1), -self.A(l2, p2, o2), self.D(p1, o1, p2, o2)))

        # Hard-code patch orientations to bind only if they point in the same direction
        if self.torsionalPatches:
            for p1 in range(self.nP):
                for p2 in range(self.nP):
                    if p2 >= p1:
                        break
                    for o1 in range(self.nO):
                        for o2 in range(self.nO):
                            v1 = utils.patchRotToVec(p1, o1)
                            v2 = utils.patchRotToVec(p2, o2)
                            # Do they point in the same global direction?
                            # And do the patches face each other?
                            if np.array_equal(v1, v2) and p2%2 == 0 and p2+1 == p1:
                                constraints.append([self.D(p1, o1, p2, o2)])
                                #print("patch {}, orientation {} binds with patch {}, orientation {}".format(p1, o1, p2, o2))
                            else:
                                constraints.append([-self.D(p1, o1, p2, o2)])

        # - Legal species placement in positions:
        # "Every position has exactly one species placed there with exactly one rotation"
        #   forall l: exactly one s and r p.t. P(l, s, r)
        for l in range(self.nL):
            constraints.extend(self._exactly_one([self.P(l, s, r) for s in range(self.nS) for r in range(self.nR)]))

        # - Legal species coloring in positions:
        # "Given a place, species and its rotation, the patch colors on the position and (rotated) species must be the same"
        #   for all l, s, r:
        #       P(l, s, r) => (forall p, c: F(l, p, c) <=> C(s, rotation(p, r), c))
        for l in range(self.nL):
            for s in range(self.nS):
                for r in range(self.nR):
                    # forall part
                    for p in range(self.nP):
                        for c in range(self.nC):
                            p_rot = self.rotation(p, r) # Patch after rotation
                            # Species 's' rotated by 'r' gets color 'c' moved from patch 'p' to 'p_rot':
                            constraints.append(( 
                                -self.P(l, s, r), # EITHER no species 's' at position 'l' with rot 'r'
                                -self.F(l, p, c), # OR no patch 'p' at position 'l' with color 'c'
                                self.C(s, p_rot, c) # OR patch 'p_rot' on species 's' DOES have the color 'c'
                            ))
                            constraints.append((
                                -self.P(l, s, r), # EITHER no species 's' at position 'l' with rot 'r'
                                self.F(l, p, c), # OR there is a patch 'p' at position 'l' with color 'c'
                                -self.C(s, p_rot, c) # OR there is no patch 'p_rot' on species 's' with the color 'c'
                            ))


        # - Legal species patch orientation in positions:
        # "Given a place, species and its rotation, the patch orientations on the position and (rotated) species must be correct"
        #   for all l, s, r:
        #       P(l, s, r) => (forall p, c: F(l, p, c) <=> C(s, rotation(p, r), c))
        if self.torsionalPatches:
            for l in range(self.nL):
                for s in range(self.nS):
                    for r in range(self.nR):
                        for p in range(self.nP):
                            for o in range(self.nO):
                                p_rot = self.rotation(p, r) # Patch after rotation
                                o_rot = self.orientation(p, r, o) # Patch orientation after rotation
                                # Species 's' rotated by 'r' gets orientation 'o' of patch 'p' changed to 'o_rot' at the new path 'p_rot':
                                #print("Species {} rotated by {}: patch {}-->{}, orientation {}-->{}".format(s, r, p, p_rot, o, o_rot))
                                constraints.append(( 
                                    -self.P(l, s, r), # EITHER no species 's' at position 'l' with rot 'r'
                                    -self.A(l, p, o), # OR no patch 'p' at position 'l' with orientation 'o'
                                    self.O(s, p_rot, o_rot) # OR patch 'p_rot' on species 's' has the orientation 'o_rot'
                                ))
                                constraints.append((
                                    -self.P(l, s, r), # EITHER no species 's' at position 'l' with rot 'r'
                                    self.A(l, p, o), # OR there is a patch 'p' at position 'l' with orientation 'o'
                                    -self.O(s, p_rot, o_rot) # OR there is no patch 'p_rot' on species 's' with the orientation 'o_rot'
                                ))
        
        if self.nD == 2:
            # Lock patch orientation if 2D
            for s in range(self.nS):
                for p in range(self.nP):
                    #v = np.array([0, 1, 0])
                    #o = utils.patchVecToRot(p, v)
                    if p>3:
                        # Patch p on species s is empty
                        constraints.append([self.C(s, p, 1)])     
                    o = utils.getFlatFaceRot()[p]
                    # Patch p has orientation 'o'
                    constraints.append([self.O(s, p, o)])

        # OPTIONAL:
        # assign colors to all slots, if there are enough of them - MUCH FASTER
        #assert self.nS * self.nP == self.nC
        #c = 0
        #for s in range(self.nS):
        #    for p in range(self.nP):
        #        constraints.append([self.C(s, p, c)])
        #        c += 1
        #assert c == self.nC

        # symmetry breaking a little bit....
        #constraints.append([self.F(0, 0, 0)])
        #constraints.append([self.P(0, 0, 0)])

        self.basic_sat_clauses.extend(constraints)
        return constraints


    def output_cnf(self,constraints,out=None):
        """ Outputs a CNF formula """
        num_vars = max(self.variables.values())
        num_constraints = len(constraints)
        outstr = "p cnf %s %s\n" % (num_vars, num_constraints)
        for c in constraints:
            outstr += ' '.join([str(v) for v in c]) + ' 0\n'
        if (out is not None):
            out.write(outstr)
        return outstr


    def load_solution_from_lines(self,lines,maxvariable=None):
        """ loads solution from sat solution output in s string"""
        if len(lines) > 1:
            assert lines[0].strip() == 'SAT'
            satline = lines[1].strip().split()
        else:
            satline = lines[0].strip().split()

        #line = myinput.readline().strip()
        #assert line == 'SAT'
        sols = [int(v) for v in satline]
        assert sols[-1] == 0
        sols = sols[:-1]
        assert len(sols) <= len(self.variables)

        return [vname for vname, vnum in self.variables.items() if vnum in sols]

    def add_constraints_from_vnames(self,vnames):
        constraints = []
        for vname in vnames:
            if vname not in self.variables:
                raise IOError("Trying to add variables that have not been defined, probably incompatible problem formulation?")
            constraints.append( self.variables[vname] )
        self.basic_sat_clauses.append(constraints)


    def convert_solution(self,myinput,output):
        """ loads solution from minisat sol in myinput handle, writes variable names to output """
        line = myinput.readline().strip()
        assert line == 'SAT'
        sols = [int(v) for v in myinput.readline().strip().split()]
        assert sols[-1] == 0
        sols = sols[:-1]
        assert len(sols) <= len(self.variables)

        for vname, vnum in sorted(self.variables.items()):
            if vnum > len(sols):
                break
            if sols[vnum-1] > 0:
                output.write(vname+'\n')

    def convert_solution2(self, sols):
        assert len(sols) <= len(self.variables)
        out = ""

        for vname, vnum in sorted(self.variables.items()):
            if vnum > len(sols):
                break
            if sols[vnum-1] > 0:
                out += vname+'\n'
        return out

    def save_named_solution(self,solution,output,B=True,C=True,P=False):
        '''saves text values of system constraints , such as B(2,3) etc'''
        handle = open(output,'w')
        for vname,vnum in sorted(self.variables.items()):
            if vnum > len(solution):
                break
            if solution[vnum-1] > 0:
                if 'B' in vname and B:
                    handle.write('%s\n' % (vname)  )
                elif 'C' in vname and C:
                    handle.write('%s\n' % (vname)  )
                elif 'P' in vname and P:
                    handle.write('%s\n' % (vname)  )
        handle.close()


    def load_constraints_from_sol(self,sol_file,append=False):
        """ loads solution from minisat output in myinput handle, adds it to self.additional_sat_clauses constraints """
        myinput = open(sol_file)
        line = myinput.readline().strip()
        assert line == 'SAT'
        sols = [int(v) for v in myinput.readline().strip().split()]
        assert sols[-1] == 0
        sols = sols[:-1]
        assert len(sols) <= len(self.variables)
        new_constraints = []
        for vname, vnum in sorted(self.variables.items()):
            if vnum > len(sols):
                break
            if sols[vnum-1] > 0:
                new_constraints.append(self.variables[vname])
                #print(vname)
        if append:
            self.additional_sat_clauses.extend(new_constraints)
        return new_constraints

    def load_constraints_from_text_sol(self,sol_file,append=True):
        """ loads solution from written output (such as B(1,3), one clause per line) in myinput handle """
        myinput = open(sol_file)
        lines = [line.strip() for line in myinput.readlines()]
        new_constraints = []
        for vname in lines:
                new_constraints.append([self.variables[vname]])
                #print(vname)
        if append:
            #print 'Addding',new_constraints, 'to', self.basic_sat_clauses
            self.basic_sat_clauses.extend(new_constraints)
            #print self.basic_sat_clauses
        return new_constraints

    def load_BC_constraints_from_text_sol(self,sol_file,append=True):
        """ loads solution from written output (such as B(1,3), one clause per line) in myinput handle """
        myinput = open(sol_file)
        lines = [line.strip() for line in myinput.readlines()]
        new_constraints = []
        for vname in lines:
            if 'B' in vname or 'C' in vname:
                new_constraints.append([self.variables[vname]])
                #print(vname)
        if append:
            #print 'Addding',new_constraints, 'to', self.basic_sat_clauses
            self.basic_sat_clauses.extend(new_constraints)
            #print self.basic_sat_clauses
        return new_constraints


    def fill_constraints(self):
        self.generate_constraints()

    def dump_cnf_to_file(self,fname):
        parameters  = self.output_cnf(self.basic_sat_clauses)
        with open(fname,'w') as outf:
            outf.write(parameters)


    def run_minisat(self, timeout=18000):
        formula = CNF(from_string = self.output_cnf(self.basic_sat_clauses))
        with Glucose4(bootstrap_with=formula.clauses) as m:
            if m.solve() == True:
                return True, self.convert_solution2(m.get_model())
            else:
                return False, None

    def add_constraints_all_particles(self):
        for s in range(self.nS):
            self.basic_sat_clauses.append( [self.P(l,s,r) for l in range(self.nL) for r in range(self.nR)]  )

    def add_constraints_all_patches(self):
        for c in range(self.nC):
            self.basic_sat_clauses.append( [self.C(s,p,c) for s in range(self.nS) for p in range(self.nP)]  )

    def add_constraints_all_patches_except(self, forbidden):
        for c in range(self.nC):
            if c != forbidden:
                self.basic_sat_clauses.append([self.C(s, p, c) for s in range(self.nS) for p in range(self.nP)])
            # Do not use forbidden color
            for p in range(self.nP):
                for s in range(self.nS):
                    self.basic_sat_clauses.append(
                            [-self.C(s, p, forbidden)]
                    )

    def add_constraints_fixed_blank_orientation(self):
        for p in range(self.nP):
            for s in range(self.nS):
                self.basic_sat_clauses.append((
                    -self.C(s, p, 1), # Either patch p on species s isn't empty
                     self.O(s, p, 0)  # Or the patch is oriented up
                ))


    def add_constraints_no_self_complementarity(self,above_color=0):
        for c in range(above_color,self.nC):
            self.basic_sat_clauses.append([-self.B(c,c)])

    def add_constraints_unique_patches(self):
        c = 0
        for s in range(self.nS):
            for p in range(self.nP):
                self.basic_sat_clauses.append([self.C(s, p, c)])
                c += 1

    def add_constraints_unique_patches_except(self, forbidden=[]):
        # "Each color is allowed exactly once in the soluton
        for c in range(self.nC):
            if c not in forbidden:
                self.basic_sat_clauses.extend(
                    self._exactly_one([self.C(s, p, c) for s in range(self.nS) for p in range(self.nP)])
                )

    def fix_particle_colors(self,ptype,sid,cid):
        self.basic_sat_clauses.append([self.C(ptype,sid,cid)])

    def fix_slot_colors(self,ptype,sid,cid):
        self.basic_sat_clauses.append([self.F(ptype,sid,cid)])

    def fix_color_interaction(self,c1,c2):
        self.basic_sat_clauses.append([self.B(c1,c2)] )


    def run_relsat(self,nSolutions, timeout=18000):
        #print("Writing data")
        tempfilename = '/tmp/temp_for_relsat.%s.cls' % (os.getpid())
        tempout = tempfilename+'.sol'
        temp = open(tempfilename,'w')
        self.output_cnf(self.basic_sat_clauses,temp)
        #temp.write(parameters)
        temp.close()
        #here we execute
        #print [self.minisat_executable,tempfilename]
        #process = subprocess.Popen([self.relsat_executable,' -#a ' ,tempfilename,tempout], stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        command = '{} -# {} -t {} {} | grep -v c > {}'.format(
            self.relsat_executable,
            nSolutions,
            timeout, # In seconds
            tempfilename,
            tempout
        )
        #print(command)
        os.system(command)

        #out = process.communicate()[0]
        out = open(tempout).readlines()
        result = out[-1].strip() #.split()[-1]
        #print result
        if result == 'UNSAT':
            return 0,0
        elif result == 'SAT':
            all_solutions = []
            for line in out:
                if 'Solution' in line:
                    myvars = line.strip().split(':')[1].strip()
                    varnames =  self.load_solution_from_lines([myvars+ ' 0'])
                    clean_sol  = []
                    for x in varnames:
                        if 'B(' in x or 'C(' in x or 'O(' in x:
                            clean_sol.append(x)
                    all_solutions.append(clean_sol)

            return len(out)-1, all_solutions
        elif result == 'TIME LIMIT EXPIRED':
            return "TIMEOUT"
        else:
            print(result)
            raise IOError("Found something else")
