import React from 'react';
import { connect } from 'react-redux';
import AbstractButton, {
    IProps as AbstractButtonProps
} from '../../../base/toolbox/components/AbstractButton';
import { translate } from '../../../base/i18n/functions';
import { closeOverflowMenuIfOpen } from '../../actions.web';
import { openAnnotator } from '../../../video-menu/components/annotator';
import { IconEdit } from '../../../base/icons/svg'; // or any icon you like

interface IProps extends AbstractButtonProps {}

/**
 * Button that opens the Excalidraw annotator overlay.
 */
class AnnotateButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.annotate';
    override label = 'toolbar.annotate';
    override icon = IconEdit;

    /**
     * Clicking the button closes the overflow menu and opens our annotator.
     */
    override _handleClick() {
        const { dispatch } = this.props;

        // analytics if you want:
        // sendAnalytics(createToolbarEvent('annotate.clicked'));

        dispatch(closeOverflowMenuIfOpen());
        openAnnotator();
    }
}

export default translate(
    connect(/* no mapState needed */)(AnnotateButton)
);