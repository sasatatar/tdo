import { VDOM, Widget } from 'cx/ui';
import { isFocused } from 'cx/util';

import marked, {Renderer} from 'marked';
import { getStyles } from './styling';

const renderer = new Renderer();
const linkRenderer = renderer.link;
renderer.link = (href, title, text) => {
    const html = linkRenderer.call(renderer, href, title, text);
    return html.replace(/^<a /, '<a target="_blank" rel="nofollow" ');
};

export class Task extends Widget {

    init() {
        if (this.bind)
            this.task = { bind: this.bind };

        super.init();
    }

    declareData() {
        super.declareData(...arguments, {
            task: undefined,
            styleRules: undefined,
            autoFocus: undefined,
            isNew: undefined
        })
    }

    render(context, instance, key) {
        return <TaskCmp key={key} instance={instance} data={instance.data} />
    }
}


class TaskCmp extends VDOM.Component {

    constructor(props) {
        super(props);

        this.state = {
            edit: props.data.isNew,
            scrollHeight: null
        };

        this.dom = {};
    }

    render() {
        let { instance, data } = this.props;
        let { widget } = instance;
        let { CSS } = widget;

        let className = CSS.block("task", {}, {
            edit: this.state.edit,
            completed: !!data.task.completed
        });

        return <div
            id={`task-${data.task.id}`}
            className={className}
            onKeyDown={this.onKeyDown.bind(this)}
            ref={el => {
                this.dom.el = el
            }}
            tabIndex={0}
            onClick={this.onClick.bind(this)}
            onTouchStart={this.onTouchStart.bind(this)}
            onDoubleClick={e => {
                this.toggleEditMode()
            }}
        >
            {!this.state.edit && this.renderContent()}
            {this.state.edit && this.renderEditor()}
        </div >
    }

    renderContent() {
        let { data, instance } = this.props;
        let { widget } = this.props.instance;
        let html = data.task.name ? marked(data.task.name, { renderer }) : '<p>&nbsp;</p>';

        let styles = getStyles(data.task.name, data.styleRules);
        let className = widget.CSS.element('checkbox', "input", {
            checked: !!data.task.completed,
        });

        return [
            <div className={className} onClick={() => {
                this.setCompleted(!data.task.completed);
            }}>
                <svg className="cxe-checkbox-input-check" viewBox="0 0 64 64">
                    <path
                        d="M7.136 42.94l20.16 14.784 29.568-40.32-9.72-7.128-22.598 30.816-10.44-7.656z"
                        fill="currentColor"
                    />
                </svg>
            </div>,
            <div key="content"
                className={widget.CSS.expand("cxe-task-content", styles.className)}
                style={styles.style}
                dangerouslySetInnerHTML={{ __html: html }}
            />]
    }

    renderEditor() {
        let { data } = this.props;
        let style = {};
        if (this.state.scrollHeight) {
            style.height = `${this.state.scrollHeight}px`;
        }
        return <textarea
            defaultValue={data.task.name}
            onMouseDown={e => {
                e.stopPropagation();
            }}
            onKeyDown={this.onEditorKeyDown.bind(this)}
            ref={c => {
                this.dom.editor = c;
            }}
            style={style}
            rows={1}
            onBlur={this.onEditorBlur.bind(this)}
            onChange={this.onChange.bind(this)}
        />
    }

    onCheck(e) {
        e.preventDefault();
        e.stopPropagation();
        this.setCompleted(e.target.checked);
    }

    setCompleted(completed = true) {
        let { instance, data } = this.props;

        let task = {
            ...data.task,
            completed: completed,
            completedDate: new Date().toISOString()
        };

        instance.set('task', task);
        instance.invoke("onSave", task, instance);
    }

    onKeyDown(e) {
        let { instance, data } = this.props;
        let { widget } = instance;

        switch (e.keyCode) {
            case 13:
            case 73: // i (insert)
            case 65: // a (append)
                e.stopPropagation();
                e.preventDefault()
                this.toggleEditMode();
                break;

            case 32:
            case 88: // x
                e.stopPropagation();
                e.preventDefault();
                this.setCompleted(!data.task.completed);
                break;

            default:
                if (widget.onKeyDown)
                    instance.invoke("onKeyDown", e, instance);
                break;
        }
    }

    save(e) {
        let { instance } = this.props;
        let { data } = instance;

        let task = {
            ...data.task,
            name: e.target.value,
            lastChange: new Date().toISOString()
        };

        delete task.isNew;

        instance.set('task', task);
        instance.invoke("onSave", task, instance);
    }

    onEditorKeyDown(e) {
        switch (e.keyCode) {
            case 13:
                e.stopPropagation();
                if (!e.ctrlKey) {
                    e.preventDefault();
                    this.save(e);
                    this.toggleEditMode();
                }
                else {
                    let start = e.target.selectionStart;
                    e.target.value = e.target.value.substring(0, start) + '\n' + e.target.value.substring(e.target.selectionEnd);
                    e.target.selectionEnd = e.target.selectionStart = start + 1;
                    this.componentDidUpdate();
                }
                break;

            case 27:
                this.save(e);
                this.toggleEditMode();
                break;

            default:
                e.stopPropagation()
                break;
        }
    }

    onEditorBlur(e) {
        this.save(e);
        this.setState({
            edit: false
        });
    }

    onChange(e) {
        this.componentDidUpdate();
    }

    onClick(e) {
        if (e.target.tagName != "A") {
            e.preventDefault();
        }
        e.stopPropagation();
    }

    onTouchStart(e) {
        if (!this.state.edit && isFocused(this.dom.el)) {
            this.toggleEditMode();
            e.stopPropagation();
            e.preventDefault();
        }
    }

    toggleEditMode() {
        let change = {
            edit: !this.state.edit
        };

        if (change.edit)
            change.scrollHeight = null;

        this.setState(change, () => {
            if (this.state.edit)
                this.dom.editor.focus();
            else
                this.dom.el.focus();
        })
    }

    componentDidMount() {
        this.props.instance.parent.toggleEditMode = this.toggleEditMode.bind(this);
        if (this.dom.el.parentNode.parentNode.parentNode.contains(document.activeElement))
            this.toggleEditMode();

        this.autoFocus();
    }

    componentDidUpdate() {
        if (this.state.edit) {
            this.dom.editor.style.width = `${this.dom.editor.scrollWidth}px`;
            if (this.dom.editor.scrollHeight > this.dom.editor.offsetHeight) {
                this.setState({
                    scrollHeight: Math.ceil(this.dom.editor.scrollHeight)
                });
            }
        }
        this.autoFocus();
    }

    autoFocus() {
        let {data} = this.props;
        if (data.autoFocus || this.state.edit) {
            if (this.state.edit)
                this.dom.editor.focus();
            else
                this.dom.el.focus();
        }
    }
}
