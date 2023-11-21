import {
  Module,
  Panel,
  Image,
  customModule,
  IDataSchema,
  Container,
  ControlElement,
  customElements,
  VStack,
  Button,
  HStack,
  Styles,
  IUISchema
} from '@ijstech/components'
import { CropType, ICropData, IImage } from './interface'
import { getIPFSGatewayUrl, setDataFromSCConfig } from './store'
import configData from './data.json'
import './index.css'
import ScomImageConfig from './config/index'
import ScomImageCrop from './crop/index'
const Theme = Styles.Theme.ThemeVars

interface ScomImageElement extends ControlElement {
  lazyLoad?: boolean;
  cid?: string;
  url: string;
  altText?: string;
  link?: string;
  cropData?: ICropData;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ['i-scom-image']: ScomImageElement
    }
  }
}

@customModule
@customElements('i-scom-image')
export default class ScomImage extends Module {
  private data: IImage = {
    cid: '',
    url: '',
    altText: '',
    backgroundColor: '',
    link: ''
  }

  private img: Image;
  private pnlImage: Panel;
  private pnlImgWrap: Panel;

  private isInitedLink: boolean = false;

  tag: any = {};

  readonly onConfirm: () => Promise<void>;
  readonly onDiscard: () => Promise<void>;
  readonly onEdit: () => Promise<void>;

  defaultEdit?: boolean;
  validate?: () => boolean;
  edit: () => Promise<void>;
  confirm: () => Promise<void>;
  discard: () => Promise<void>;

  constructor(parent?: Container, options?: any) {
    super(parent, options);
    if (configData)
      setDataFromSCConfig(configData);
  }

  init() {
    super.init()
    this.setTag({ width: '100%', height: 'auto' });
    const lazyLoad = this.getAttribute('lazyLoad', true, false);
    if (!lazyLoad) {
      let cid = this.getAttribute('cid', true);
      const ipfsGatewayUrl = getIPFSGatewayUrl()
      this.url = this.getAttribute('url', true) || (cid ? ipfsGatewayUrl + cid : "");
      this.altText = this.getAttribute('altText', true);
      const cropData = this.getAttribute('cropData', true);
      if (cropData) this.cropData = cropData;
      this.data.photoId = this.options?.photoId || '';
      this.data.keyword = this.options?.keyword || '';
    }
  }

  static async create(options?: ScomImageElement, parent?: Container) {
    let self = new this(parent, options);
    await self.ready();
    return self;
  }

  get url() {
    return this.data.url ?? '';
  }
  set url(value: string) {
    this.data.url = value;
    if (!value) {
      this.img.url = 'https://placehold.co/600x400?text=No+Image'
      return
    }
    if (this.data.url?.startsWith('ipfs://')) {
      const ipfsGatewayUrl = getIPFSGatewayUrl()
      this.img.url = this.data.url.replace('ipfs://', ipfsGatewayUrl)
    } else {
      this.img.url = this.data.url
    }
  }

  get altText() {
    return this.data.altText ?? '';
  }
  set altText(value: string) {
    this.data.altText = value;
    const imgElm = this.img.querySelector('img')
    imgElm && imgElm.setAttribute('alt', this.data.altText || '')
  }

  get link() {
    return this.data.link ?? '';
  }
  set link(value: string) {
    this.data.link = value;
  }

  get cropData() {
    return this.data.cropData;
  }
  set cropData(value: ICropData) {
    this.data.cropData = value;
    this.updateCropUI()
  }

  getConfigurators() {
    const self = this;
    return [
      {
        name: 'Builder Configurator',
        target: 'Builders',
        getActions: () => {
          return this._getActions('Builders');
        },
        getData: this.getData.bind(this),
        setData: this.setData.bind(this),
        getTag: this.getTag.bind(this),
        setTag: this.setTag.bind(this)
      },
      {
        name: 'Emdedder Configurator',
        target: 'Embedders',
        getData: this.getData.bind(this),
        setData: this.setData.bind(this),
        getTag: this.getTag.bind(this),
        setTag: this.setTag.bind(this)
      },
      {
        name: 'Editor',
        target: 'Editor',
        getActions: () => {
          return this._getActions('Editor')
        },
        getLink: () => {
          const encodedWidgetDataString  = window.btoa(JSON.stringify(self._getWidgetData()));
          const loaderUrl = `https://ipfs.scom.dev/ipfs/bafybeia442nl6djz7qipnfk5dxu26pgr2xgpar7znvt3aih2k6nxk7sib4`
          return `${loaderUrl}?data=${encodedWidgetDataString}`
        },
        getLinkParams: () => {
          return {
            data: window.btoa(JSON.stringify(self._getWidgetData()))
          }
        },
        setLinkParams: async (params: any) => {
          if (params.data) {
            const utf8String = decodeURIComponent(params.data);
            const decodedString = window.atob(utf8String);
            const newData = JSON.parse(decodedString);
            let resultingData = {
              ...self.data,
              ...(newData.properties || {})
            };
            this.setData(resultingData);
          }
        },
        getData: this.getData.bind(this),
        setData: this.setData.bind(this),
        getTag: this.getTag.bind(this),
        setTag: this.setTag.bind(this)
      }
    ]
  }

  private _getWidgetData() {
    return {
      "module": {
        "name": "@scom/scom-image",
        "localPath": "scom-image"
      },
      "properties": {
        ...(this.data || {})
      }
    }
  }

  private _getActions(target?: string) {
    const self = this;
    const parentToolbar = self.closest('ide-toolbar');
    const editAction = {
      name: 'Edit',
      icon: 'edit',
      command: (builder: any, userInputData: any) => {
        let oldData: IImage = { url: '' };
        return {
          execute: () => {
            oldData = JSON.parse(JSON.stringify(this.data));
            if (builder?.setData) builder.setData(userInputData);
            this.setData(userInputData);
          },
          undo: () => {
            if (builder?.setData) builder.setData(oldData);
            this.setData(oldData);
          },
          redo: () => { }
        }
      },
      customUI: {
        render: (data?: any, onConfirm?: (result: boolean, data: any) => void) => {
          const vstack = new VStack(null, {gap: '1rem'});
          const config = new ScomImageConfig(null, {...this.data, canUpload: target !== 'Editor'});
          const hstack = new HStack(null, {
            verticalAlignment: 'center',
            horizontalAlignment: 'end'
          });
          const button = new Button(null, {
            caption: 'Confirm',
            width: '100%',
            height: 40,
            font: {color: Theme.colors.primary.contrastText}
          });
          hstack.append(button);
          vstack.append(config);
          vstack.append(hstack);
          button.onClick = async () => {
            if (onConfirm) onConfirm(true, {...this.data, ...config.data});
          }
          return vstack;
        }
      }
    };
    if (target === 'Editor') return [editAction];
    return [
      {
        name: 'Crop',
        icon: 'crop',
        command: (builder: any, userInputData: any) => {
          let oldData: IImage = { url: '' };
          return {
            execute: () => {
              oldData = JSON.parse(JSON.stringify(this.data));
              if (builder?.setData) builder.setData(userInputData);
              this.setData(userInputData);
            },
            undo: () => {
              if (builder?.setData) builder.setData(oldData);
              this.setData(oldData);
            },
            redo: () => { }
          }
        },
        customUI: {
          render: (data?: any, onConfirm?: (result: boolean, data: any) => void) => {
            const vstack = new VStack(null, {gap: '1rem'});
            const config = new ScomImageCrop(null, {...this.data});
            const hstack = new HStack(null, {
              verticalAlignment: 'center',
              horizontalAlignment: 'end'
            });
            const button = new Button(null, {
              caption: 'Confirm',
              width: '100%',
              height: 40,
              font: {color: Theme.colors.primary.contrastText}
            });
            hstack.append(button);
            vstack.append(config);
            vstack.append(hstack);
            if (parentToolbar) parentToolbar.classList.add('is-editing');
            button.onClick = async () => {
              if (onConfirm) {
                config.onCrop();
                onConfirm(true, {...this.data, ...config.data});
                self.updateCropUI()
                if (parentToolbar) parentToolbar.classList.remove('is-editing');
              }
            }
            return vstack;
          }
        }
      },
      editAction,
      {
        name: 'Widget Settings',
        icon: 'edit',
        ...this.getWidgetSchemas()
      }
    ];
  }

  private getWidgetSchemas(): any {
    const propertiesSchema: IDataSchema = {
      type: 'object',
      properties: {
        pt: {
          title: 'Top',
          type: 'number'
        },
        pb: {
          title: 'Bottom',
          type: 'number'
        },
        pl: {
          title: 'Left',
          type: 'number'
        },
        pr: {
          title: 'Right',
          type: 'number'
        },
        align: {
          type: 'string',
          title: 'Alignment',
          enum: [
            'left',
            'center',
            'right'
          ]
        },
        maxWidth: {
          type: 'number'
        },
        link: {
          title: 'URL',
          type: 'string'
        }
      }
    };
    const themesSchema: IUISchema = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'HorizontalLayout',
          elements: [
            {
              type: 'Group',
              label: 'Padding (px)',
              elements: [
                {
                  type: 'VerticalLayout',
                  elements: [
                    {
                      type: 'HorizontalLayout',
                      elements: [
                        {
                          type: 'Control',
                          scope: '#/properties/pt',
                        },
                        {
                          type: 'Control',
                          scope: '#/properties/pb',
                        },
                        {
                          type: 'Control',
                          scope: '#/properties/pl',
                        },
                        {
                          type: 'Control',
                          scope: '#/properties/pr',
                        },
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          type: 'HorizontalLayout',
          elements: [
            {
              type: 'Control',
              label: 'Max Width',
              scope: '#/properties/maxWidth',
            }
          ]
        },
        {
          type: 'HorizontalLayout',
          elements: [
            {
              type: 'Control',
              label: 'Alignment',
              scope: '#/properties/align',
            }
          ]
        },
        {
          type: 'HorizontalLayout',
          elements: [
            {
              type: 'Control',
              label: 'URL',
              scope: '#/properties/link',
            }
          ]
        }
      ]
    };
    return {
      userInputDataSchema: propertiesSchema,
      userInputUISchema: themesSchema
    }
  }

  private getData() {
    return this.data
  }

  private setData(value: IImage) {
    this.data = value;
    this.updateImg()
    this.updateCropUI()
    this.pnlImage.background.color = value.backgroundColor || '';
  }

  private updateImg() {
    if (this.data.cid) {
      const ipfsGatewayUrl = getIPFSGatewayUrl()
      this.img.url = ipfsGatewayUrl + this.data.cid;
    } else if (this.data.url?.startsWith('ipfs://')) {
      const ipfsGatewayUrl = getIPFSGatewayUrl()
      this.img.url = this.data.url.replace('ipfs://', ipfsGatewayUrl)
    } else {
      this.img.url = this.data.url || 'https://placehold.co/600x400?text=No+Image'
    }
    if (this.tag.width || this.tag.height) {
      this.img.display = 'block';
      this.tag.width && (this.img.width = this.tag.width)
      this.tag.width && (this.img.height = this.tag.height)
    }
    const imgElm = this.img.querySelector('img')
    imgElm && imgElm.setAttribute('alt', this.data.altText || '')
  }

  private updateCropUI() {
    const cropData = this.data.cropData
    const imgTag = this.img.querySelector('img')
    if (!imgTag) return
    if (cropData) {
      const { left, top, width, height, aspectRatio, type = CropType.PREEFORM } = cropData
      this.pnlImage.classList.add('cropped-pnl')
      const parentWidth = this.pnlImage.offsetWidth
      const right = left + width
      const bottom = top + height
      const scale = parentWidth / (width / 100 * parentWidth)
      if (type === CropType.CIRCLE) {
        imgTag.style.transform = `scale(${scale}) translate(-${left}%, -${top}%)`;
        const x = left + width / 2
        const y = top + height / 2
        const radius = `${(width / 100 * parentWidth) / 2}px`
        imgTag.style.clipPath = `circle(${radius} at ${x}% ${y}%)`
        this.pnlImage && (this.pnlImage.style.aspectRatio = `1 / 1`)
      } else {
        imgTag.style.transform = `scale(${scale}) translate(-${left}%, -${top}%)`;
        imgTag.style.clipPath = `polygon(${left}% ${top}%, ${right}% ${top}%, ${right}% ${bottom}%, ${left}% ${bottom}%)`
        if (this.pnlImage && typeof(aspectRatio) == 'string')
          this.pnlImage.style.aspectRatio = `${aspectRatio.replace(':', '/')}`
        else
          this.pnlImage.style.aspectRatio = `${aspectRatio}/1`
      }
    } else {
      this.pnlImage.classList.remove('cropped-pnl')
      imgTag.style.clipPath = ''
      imgTag.style.transform = ''
      this.pnlImgWrap && (this.pnlImgWrap.style.aspectRatio = ``)
    }
  }

  async connectedCallback() {
    super.connectedCallback();
    if (!this.isConnected) return;
    const link = this.data.link || this.getAttribute('link', true);
    if (link !== undefined && !this.isInitedLink) {
      this.isInitedLink = true;
      this.link = link;
    }
  }

  private getTag() {
    return this.tag
  }

  private async setTag(value: any) {
    this.tag = value;
    const { width, height, maxWidth, align, link } = this.tag
    if (this.pnlImage) {
      this.pnlImage.style.removeProperty('aspectRatio');
      if (maxWidth !== undefined) {
        this.pnlImage.maxWidth = maxWidth;
      } else {
        this.pnlImage.maxWidth = '100%';
      }
      if (align !== undefined) {
        let customMargin = {};
        if (align === 'left') customMargin = {right: 'auto'};
        else if (align === 'right') customMargin = {left: 'auto'};
        else customMargin = {right: 'auto', left: 'auto'};
        this.pnlImage.margin = customMargin;
      } else {
        this.pnlImage.style.removeProperty('margin')
      }
    }
    if (this.img) {
      this.img.display = "block";
      this.img.width = width;
      this.img.height = height;
      this.updateCropUI();
    }
    if (link) {
      this.classList.add('pointer');
    } else {
      this.classList.remove('pointer');
    }
  }
  
  private onImageClick() {
    if (!this.tag.link) return;
    window.open(this.tag.link, '_blank');
  }

  render() {
    return (
      <i-panel id={'pnlImgWrap'} height="100%">
        <i-vstack id={'pnlImage'} class="img-wrapper">
          <i-image
            id={'img'}
            // url={'https://placehold.co/600x400?text=No+Image'}
            class="custom-img"
            onClick={this.onImageClick.bind(this)}
          ></i-image>
        </i-vstack>
      </i-panel>
    )
  }
}
