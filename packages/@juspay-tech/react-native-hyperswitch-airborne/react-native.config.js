module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.hyperswitchairborne.HyperswitchAirbornePackage;',
        packageInstance: 'new HyperswitchAirbornePackage()',
      },
    },
  },
};
