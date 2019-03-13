## Polycubes

#### Presented by Joakim Bohlin

<img src="../flower.png" width="500"></img>

---

## Self-assembled cubes
The original DNA robotics proposal

<img src="https://dnarobotics.files.wordpress.com/2017/09/fig-2-esa-new-beskacc8aret-2017-09-27-v1.png" height="100%" style="border:0px; background-color:rgba(0,0,0,0); box-shadow: 0 0 0px rgba(0,0,0,0);"></img>

---

## Polyominoes
by Iain Johnston

<img src="polycubes.svg" height="500" style="border:0px; background-color:rgba(0,0,0,0); box-shadow: 0 0 0px rgba(0,0,0,0);"></img>

-->

<!-- .slide: data-background-iframe="http://chaoticsymmetry.co.uk/polyominoes/index-old.php#" data-background-interactive -->

---

## Syntax for rules

<object data="../ruleOrder.svg" type="image/svg+xml" height="500"></object>

Notes: A winner-take-all (WTA) neural network with m memories that each
has n bits; x<sub>1</sub> to x<sub>n</sub> and y<sub>1</sub> to y<sub>m</sub> are binary inputs and outputs, respectively; 
w<sub>ij</sub> (1 <= i <= n and 1 <= j <= m) are analogue weights of positive, real numbers; s<sub>j</sub> and s<sub>k</sub> (1 <= j != k <= m) are weighted sums of the inputs.

---

## Example

<img src="../rulePairing.svg" height="100%" style="border:0px; background-color:rgba(0,0,0,0); box-shadow: 0 0 0px rgba(0,0,0,0);"></img>

Notes: Example pattern recognition using target patterns as weights. Each 9-bit pattern is shown in a 3x3 grid. Each black or coloured pixel indicates a 1 and each white pixel indicates a 0. The two target patterns correspond to the letters 'L' and 'T', respectively. If the input pattern is corrupted (for example, the last bit of 'L' is flipped from 1 to 0, as indicated by the orange cross), then the neural network can still recognize it as being more similar to 'L' than to 'T', because the weighted sum using 'L' as weights is still larger than the weighted sum using 'T' as weights.

---

<!-- .slide: data-background-iframe="https://akodiat.github.io/polycubes/index.html" data-background-interactive -->

---

# Any questions?

---

<img src="european-commission.png" height="300" style="border:0px; background-color:rgba(0,0,0,0); box-shadow: 0 0 0px rgba(0,0,0,0);"></img>

This project has received funding from the European Union's Horizon 2020 research and innovation programme under the Marie Sklodowska-Curie grant agreement No 765703
