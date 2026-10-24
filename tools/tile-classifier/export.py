import sys; sys.argv=['x','1']
exec(open('tools/tile-classifier/train.py').read().split("if __name__")[0])
net.load_state_dict(torch.load('tools/tile-classifier/net.pt')); net.eval().cpu()
torch.onnx.export(net,torch.zeros(1,3,44,32),'public/models/mahjong-tiles.onnx',input_names=['x'],output_names=['logits'],dynamic_axes={'x':{0:'n'},'logits':{0:'n'}},dynamo=False)
