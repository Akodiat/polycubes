#include <random>
#include <chrono>

int main(void) {
    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    int hex = 16;
    std::mt19937 randomNumGen(seed);
    std::uniform_int_distribution<size_t> rnd_dist(0, hex-1);
    for(int i=0; i<12; i++) {
        unsigned int r = rnd_dist(randomNumGen);
        printf("%x", r);
    }
}
