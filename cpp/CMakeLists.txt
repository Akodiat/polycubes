cmake_minimum_required(VERSION 3.10)

project(polycubes LANGUAGES CXX C)

set (CMAKE_CXX_STANDARD 11)

# Save binary directly in root folder (cpp)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR})

add_subdirectory(src)