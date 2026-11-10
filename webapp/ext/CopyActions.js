sap.ui.define([
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/MessageBox",
    "sap/m/VBox",
    "sap/ui/model/json/JSONModel"
], function (Button, Dialog, Input, Label, MessageBox, VBox, JSONModel) {
    "use strict";

    var aFields = [
        ["Companycode", "Company Code"],
        ["Accounttype", "Account Type"],
        ["Customer", "Customer"],
        ["Itemcategory", "Item Category"],
        ["Reftype", "Reference Type"],
        ["GLAccount", "G/L Account"],
        ["Text", "Text"],
        ["Reference1", "Reference 1"],
        ["Reference2", "Reference 2"],
        ["Reference3", "Reference 3"],
        ["Taxcode", "Tax Code"],
        ["Profitcenter", "Profit Center"],
        ["InternalOrder", "Internal Order"],
        ["RuleBase", "Rule Base"]
    ];
    async function saveCopy(oModel, oPayload) {
        var sNamespace = "com.sap.gateway.srvd.y0fi_ui_arpay_cnf.v0001.";
        var oList = oModel.bindList("/Configurations", null, null, null, {
            $$updateGroupId: "$direct"
        });
        var oDraft;
        var bDraftCreated = false;

        async function runAction(sAction) {
            var oAction = oModel.bindContext(
                sNamespace + sAction + "(...)",
                oDraft
            );

            try {
                await oAction.execute("$direct");
            } finally {
                oAction.destroy();
            }
        }

        try {
            var fnCompleted;
            var pCompleted = new Promise(function (resolve) {
                fnCompleted = function (oEvent) {
                    if (oEvent.getParameter("context") === oDraft) {
                        resolve(oEvent.getParameter("success"));
                    }
                };
            });

            oList.attachCreateCompleted(fnCompleted);

            try {
                oDraft = oList.create(
                    Object.assign({}, oPayload, { IsActiveEntity: false }),
                    true
                );

                // A failed POST can leave created() pending for a retry.
                if (!(await pCompleted)) {
                    throw new Error(
                        "Could not create the copy. Check whether the destination key already exists."
                    );
                }

                bDraftCreated = true;
                await oDraft.created();
            } finally {
                oList.detachCreateCompleted(fnCompleted);
            }

            await runAction("Prepare");
            await runAction("Activate");
        } catch (oError) {
            if (oDraft) {
                try {
                    if (bDraftCreated) {
                        await runAction("Discard");
                    } else {
                        await oDraft.delete();
                    }
                } catch (oCleanupError) {
                    var oFailure = new Error(
                        "Save could not be confirmed and draft cleanup failed. " +
                        "Check the destination record or draft before retrying."
                    );
                    oFailure.cleanupFailed = true;
                    throw oFailure;
                }
            }

            throw oError;
        } finally {
            oList.destroy();
        }
    }
    return {
        openCopyDialog: async function (oContext, aSelectedContexts) {
            if (!aSelectedContexts || aSelectedContexts.length !== 1) {
                MessageBox.information("Select exactly one row to copy.");
                return;
            }

            var oSource = aSelectedContexts[0];
            var oCopy = {};

            try {
                await Promise.all(aFields.map(async function (aField) {
                    oCopy[aField[0]] = await oSource.requestProperty(aField[0]);
                }));
            } catch (oError) {
                MessageBox.error("Could not read the selected configuration.");
                return;
            }
            var aKeyFields = ["Companycode", "Accounttype", "Customer", "Itemcategory"];
            var oOriginal = Object.assign({}, oCopy);
            var bSaving = false;
            var bCleanupFailed = false;
            var oModel = new JSONModel(oCopy);
            var oForm = new VBox().addStyleClass("sapUiSmallMargin");

            aFields.forEach(function (aField) {
                var oInput = new Input({
                    value: "{copy>/" + aField[0] + "}",
                    valueLiveUpdate: true,
                    width: "100%"
                });

                oForm.addItem(new Label({
                    text: aField[1],
                    labelFor: oInput.getId()
                }));
                oForm.addItem(oInput);
            });

            var oDialog = new Dialog({
                title: "Copy AR Payment Configuration",
                contentWidth: "32rem",
                contentHeight: "28rem",
                content: [oForm],
                beginButton: new Button({
                    text: "Save",
                    type: "Emphasized",
                    press: async function (oEvent) {
                        if (bSaving || bCleanupFailed) {
                            return;
                        }

                        var oPayload = Object.assign({}, oModel.getData());

                        aKeyFields.forEach(function (sField) {
                            oPayload[sField] = String(oPayload[sField] ?? "").trim();
                        });

                        var bSameKey = aKeyFields.every(function (sField) {
                            return oPayload[sField] === String(oOriginal[sField] ?? "").trim();
                        });

                        if (bSameKey) {
                            MessageBox.error(
                                "An AR payment configuration already exists for this combination."
                            );
                            return;
                        }

                        bSaving = true;
                        oDialog.setBusy(true);

                        try {
                            await saveCopy(oSource.getModel(), oPayload);
                        } catch (oError) {
                            if (oError.cleanupFailed) {
                                bCleanupFailed = true;
                                oEvent.getSource().setEnabled(false);
                            }
                            MessageBox.error(oError.message);
                            return;
                        } finally {
                            oDialog.setBusy(false);
                            bSaving = false;
                        }

                        oDialog.close();
                        oSource.getBinding().refresh();
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                    oModel.destroy();
                }
            });

            oDialog.setModel(oModel, "copy");
            oDialog.open();
        }
    };
});