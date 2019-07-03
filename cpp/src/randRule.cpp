#include <random>
#include <chrono>
#include <bitset>
#include <math.h>

int main(int argc, char** argv) {
    const int colBits = 5;
    const int rotBits = 2;
    int maxColor = pow(2, colBits); // 32;
    int nRotations = pow(2, rotBits); // 4;
    int maxCubes = 5;
    int nRules = 1;
    if (argc > 1) {
        nRules = (int) std::stod(argv[1]);
    }
    if (argc > 2) {
        maxColor = std::stoi(argv[2]);
    }
    if (argc > 3) {
        maxCubes = std::stoi(argv[3]);
    }
    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    int hex = 16;
    std::mt19937 r(seed);
    std::uniform_int_distribution<size_t> signDist(0, 1);
    std::uniform_int_distribution<size_t> colorDist(0, maxColor-1);
    std::uniform_int_distribution<size_t> rotDist(0, nRotations-1);
    std::uniform_int_distribution<size_t> nRuleDist(1, maxCubes);
    while (nRules--) {
        int nCubes = nRuleDist(r);
        while (nCubes --) {
            for(int i=0; i<6; i++) {
                int sign  = signDist(r);
                int color = colorDist(r);
                int rot   = rotDist(r);
                std::string signStr = std::bitset<1>(sign).to_string();
                std::string colorStr = std::bitset<colBits>(color).to_string();
                std::string rotStr = std::bitset<rotBits>(rot).to_string();
                std::string totStr = signStr + colorStr + rotStr;
                int rule = std::stoi(totStr, 0, 2);
                printf("%02x", rule);
            }
        }
        printf(" ");
    }
}
