set(
        polycube_source_files
        main.cpp
        polycubeSystem.cpp
        utils.cpp
        io.cpp
)

set(
        polycube_header_files
        polycubeSystem.hpp
        utils.hpp
        io.hpp
)


add_executable(polycubes ${polycube_source_files} ${polycube_header_files})
target_include_directories(polycubes INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})


# Link Eigen
find_package (Eigen3 3.3 REQUIRED NO_MODULE)
target_link_libraries (polycubes Eigen3::Eigen)


# HDFQL

set(HDFQL_ROOT "~/hdfql-2.3.0")
include_directories(${HDFQL_ROOT}/include)
find_library(HDFQL_LIB HDFql)

target_include_directories(polycubes
    PUBLIC "${HDFQL_ROOT}/include"
)

# Link HDFql
target_link_libraries(
    polycubes
   "${HDFQL_ROOT}/wrapper/cpp/libHDFql.so"
)
