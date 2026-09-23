if(NOT TARGET react-native-nitro-image::NitroImage)
add_library(react-native-nitro-image::NitroImage INTERFACE IMPORTED)
set_target_properties(react-native-nitro-image::NitroImage PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "/Users/3dzx/Downloads/PetApp/mobile/node_modules/react-native-nitro-image/android/build/headers/nitroimage"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

