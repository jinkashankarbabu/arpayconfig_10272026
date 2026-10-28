sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/redbull/fi/arpayconfig/test/integration/pages/ConfigurationsList.gen",
	"com/redbull/fi/arpayconfig/test/integration/pages/ConfigurationsObjectPage.gen"
], function (JourneyRunner, ConfigurationsListGenerated, ConfigurationsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/redbull/fi/arpayconfig') + '/test/flp.html#app-preview',
        pages: {
			onTheConfigurationsListGenerated: ConfigurationsListGenerated,
			onTheConfigurationsObjectPageGenerated: ConfigurationsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

